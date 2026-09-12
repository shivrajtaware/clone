import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import useAuthStore from '../context/authStore'
import { Eye, EyeOff, LogIn } from 'lucide-react'

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
      const details = err.response?.data?.errors
        ?.map(error => `${error.field}: ${error.message}`)
        .join(', ')
      toast.error(details || err.response?.data?.message || err.message || 'Login failed. Check credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-[580px] sm:min-h-[620px] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#741541] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[34px] border-white/10" />
        <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full border-[28px] border-white/10" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 p-1 shadow-lg">
              <img src="/brand-mark.png" alt="" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight">Dr.AiSolnex HMS</div>
              <div className="text-xs text-white/65">CityCare Multispeciality Hospital</div>
            </div>
          </div>

          <div className="mt-24 max-w-md">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#ffd3e5]">Hospital operations, in one view</p>
            <h2 className="text-4xl font-semibold leading-tight tracking-tight">Confident care starts with clear information.</h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/72">
              Connect patient care, appointments, diagnostics, pharmacy and billing with a calm, reliable workspace for every team.
            </p>
          </div>
        </div>

        <div className="relative grid grid-cols-3 gap-3 border-t border-white/15 pt-5 text-xs text-white/70">
          <div><div className="mb-1 text-base font-semibold text-white">24/7</div>Care visibility</div>
          <div><div className="mb-1 text-base font-semibold text-white">One</div>Connected record</div>
          <div><div className="mb-1 text-base font-semibold text-white">Secure</div>Staff access</div>
        </div>
      </section>

      <section className="flex items-center bg-white px-6 py-9 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <img src="/brand-mark.png" alt="Dr.AiSolnex" className="h-12 w-12 rounded-xl bg-[#fff4f8] p-1 object-contain" />
              <div>
                <div className="font-bold text-[#2a101f]">Dr.AiSolnex HMS</div>
                <div className="text-xs text-[#765668]">Hospital Management System</div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <img src="/brand-logo.png" alt="Dr.AiSolnex" className="mb-6 h-24 w-52 rounded-xl border border-[#f2dce7] bg-[#fffafb] p-1 object-contain" />
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#bd326d]">Staff portal</p>
            <h1 className="text-3xl font-semibold tracking-tight text-[#21101b]">Welcome back</h1>
            <p className="mt-2 text-sm leading-5 text-[#765668]">Sign in to continue to your hospital workspace.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@hospital.com"
                {...register('email', { required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' } })}
              />
              {errors.email && <p className="mt-1 text-xs text-brand-red">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Enter your password"
                  {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Min 8 characters' } })}
                />
                <button type="button" className="btn-ghost absolute right-2 top-1/2 !min-h-0 -translate-y-1/2 !p-1.5" onClick={() => setShowPass(v => !v)} aria-label={showPass ? 'Hide password' : 'Show password'}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-brand-red">{errors.password.message}</p>}
            </div>
            <button type="submit" disabled={loading} className="btn-primary mt-2 w-full py-2.5 text-sm">
              {loading ? 'Signing in...' : <><LogIn size={16} /> Sign in securely</>}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-3 border-t border-[#f0dfe7] pt-4 text-xs text-[#765668]">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Secure hospital workspace · v1.0.0
          </div>
        </div>
      </section>
    </div>
  )
}
