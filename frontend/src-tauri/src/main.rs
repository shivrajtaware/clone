#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use std::{
    env, fs,
    io::{Read, Write},
    net::{IpAddr, Ipv4Addr, TcpStream, ToSocketAddrs, UdpSocket},
    path::PathBuf,
    sync::{mpsc, Arc, atomic::{AtomicBool, Ordering}},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const DEFAULT_SERVER_URL: &str = "http://DESKTOP-5OD2NDB:5000";

#[derive(Debug, Deserialize)]
struct ServerConfig {
    #[serde(alias = "url")]
    server_url: Option<String>,
}

fn normalize_url(value: &str) -> String {
    value.trim().trim_end_matches('/').to_string()
}

fn read_config(path: PathBuf) -> Option<String> {
    let contents = fs::read_to_string(path).ok()?;
    let config: ServerConfig = serde_json::from_str(&contents).ok()?;
    let value = normalize_url(config.server_url?.as_str());
    if value.starts_with("http://") || value.starts_with("https://") {
        Some(value)
    } else {
        None
    }
}

fn server_url(app: &AppHandle) -> String {
    if let Ok(value) = env::var("MEDICORE_SERVER_URL") {
        let value = normalize_url(&value);
        if value.starts_with("http://") || value.starts_with("https://") {
            return value;
        }
    }

    let app_config = app.path().app_config_dir().ok().map(|path| path.join("server-config.json"));
    let resource_config = app.path().resource_dir().ok().map(|path| path.join("server-config.json"));
    let executable_config = env::current_exe().ok().map(|path| path.with_file_name("server-config.json"));

    for path in [app_config, resource_config, executable_config].into_iter().flatten() {
        if let Some(value) = read_config(path) {
            return value;
        }
    }

    discover_lan_server().unwrap_or_else(|| DEFAULT_SERVER_URL.to_string())
}

fn is_healthy_server(url: &str) -> bool {
    let address = url
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .split('/')
        .next()
        .unwrap_or_default();
    let mut addresses = match address.to_socket_addrs() {
        Ok(values) => values,
        Err(_) => return false,
    };
    let socket = match addresses.next() {
        Some(value) => value,
        None => return false,
    };
    let mut stream = match TcpStream::connect_timeout(&socket, Duration::from_millis(250)) {
        Ok(value) => value,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.write_all(b"GET /health HTTP/1.1\r\nHost: medicore-lan-client\r\nConnection: close\r\n\r\n");
    let mut response = [0_u8; 1024];
    let size = stream.read(&mut response).unwrap_or(0);
    let body = String::from_utf8_lossy(&response[..size]);
    body.contains("200") && body.contains("MediCore HMS API")
}

fn local_ipv4() -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(address) => Some(address),
        IpAddr::V6(_) => None,
    }
}

fn discover_lan_server() -> Option<String> {
    let address = local_ipv4()?;
    let octets = address.octets();
    let (sender, receiver) = mpsc::channel();
    let stopped = Arc::new(AtomicBool::new(false));

    for worker in 0..32_u8 {
        let sender = sender.clone();
        let stopped = Arc::clone(&stopped);
        thread::spawn(move || {
            let mut host = worker as u16 + 1;
            while host <= 254 && !stopped.load(Ordering::Relaxed) {
                let candidate = format!("http://{}.{}.{}.{}:5000", octets[0], octets[1], octets[2], host);
                if is_healthy_server(&candidate) {
                    stopped.store(true, Ordering::Relaxed);
                    let _ = sender.send(candidate);
                    return;
                }
                host += 32;
            }
        });
    }

    drop(sender);
    receiver.recv_timeout(Duration::from_secs(12)).ok()
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let configured = server_url(app.handle());
            let url = if is_healthy_server(&configured) {
                configured
            } else {
                discover_lan_server().unwrap_or(configured)
            };
            let init_script = format!(
                "window.__MEDICORE_SERVER_URL__ = {};",
                serde_json::to_string(&url).expect("server URL serializes")
            );
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .initialization_script(&init_script)
                .title("MediCore HMS")
                .inner_size(1400.0, 900.0)
                .min_inner_size(1024.0, 700.0)
                .resizable(true)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MediCore HMS");
}
