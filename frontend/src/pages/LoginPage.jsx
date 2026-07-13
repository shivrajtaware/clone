import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import useAuthStore from '../context/authStore'
import { Eye, EyeOff, HeartPulse, LogIn } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async ({ email, password }) => {
    setLoading(true)
    try {
      const user = await login(email, password)
      toast.success(`Welcome back, ${user.first_name}!`)
      navigate(user.role === 'SUPER_ADMIN' ? '/superadmin' : '/')
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Login failed. Check credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm animate-slide-up">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-300 via-cyan to-cyan-dark flex items-center justify-center shadow-glow-cyan mb-4 text-white animate-float-soft">
          <HeartPulse size={30} strokeWidth={2.2} />
        </div>
        <h1 className="text-2xl font-bold text-white">Dr.AiSolnex HMS</h1>
        <p className="text-sm text-slate-400 mt-1">Hospital Management System</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-5">Sign In</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="you@hospital.com"
              {...register('email', { required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' } })}
            />
            {errors.email && <p className="text-xs text-brand-red mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="input pr-10"
                placeholder="Enter password"
                {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
              />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost !p-1.5 !min-h-0" onClick={() => setShowPass(v => !v)} aria-label={showPass ? 'Hide password' : 'Show password'}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-brand-red mt-1">{errors.password.message}</p>}
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm">
            {loading ? 'Signing in...' : <><LogIn size={16} /> Sign In</>}
          </button>
        </form>

        <div className="divider" />
        <div className="text-xs text-slate-500 space-y-1">
          {/* <div className="font-medium text-slate-400 mb-2">Quick login credentials:</div> */}
          {/* {[
            ['Super Admin', 'superadmin@draisolnex.com'],
            ['Hospital Admin', 'admin@cityhospital.com'],
            ['Doctor', 'doctor@cityhospital.com'],
          ].map(([role, email]) => (
            <div key={role} className="flex justify-between items-center gap-3 bg-navy-800 rounded-lg px-2.5 py-1.5">
              <span className="text-slate-400 truncate">{role}</span>
              <span className="text-cyan font-mono text-[10px] truncate">{email}</span>
            </div>
          ))} */}
        </div>
      </div>

      <p className="text-center text-xs text-slate-500 mt-4">
        2026 Dr.AiSolnex Technologies - v1.0.0
      </p>
    </div>
  )
}
