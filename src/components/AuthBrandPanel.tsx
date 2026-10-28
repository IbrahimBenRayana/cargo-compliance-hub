import { KeyRound, Lock, UserCheck } from 'lucide-react';
import { LogoMark } from '@/components/LogoMark';
import { AuthScene } from '@/components/auth3d/AuthScene';
import type { AuthSceneState } from '@/components/auth3d/state';

export interface AuthBrandPanelProps {
  /** live form state the 3D scene reacts to (gate = sign in, berth = sign up) */
  scene: AuthSceneState;
  /** one calm line under the scene */
  caption: string;
}

// Only statements that are true today: no certifications we don't hold and no
// claim of a live direct CBP connection.
const FACTS = [
  { icon: KeyRound, label: 'Multi-factor sign-in' },
  { icon: Lock, label: 'Encrypted in transit (TLS)' },
  { icon: UserCheck, label: 'Invite-only workspaces' },
];

/**
 * Always-dark brand panel on the auth pages (desktop only). The interactive
 * 3D scene fills it; wordmark on top, a caption and the facts row below.
 */
export function AuthBrandPanel({ scene, caption }: AuthBrandPanelProps) {
  return (
    <div
      className="relative hidden h-screen overflow-hidden lg:flex lg:flex-col lg:justify-between"
      style={{ background: 'hsl(222, 47%, 8%)' }}
    >
      {/* soft gold glow the diorama floats on */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[8%] top-[18%] bottom-[22%] blur-[10px]"
        style={{ background: 'radial-gradient(closest-side, hsl(43 96% 56% / .12), hsl(222 60% 30% / .18) 55%, transparent 80%)' }}
      />

      <AuthScene state={scene} />

      {/* fade the scene into the panel at the top and bottom so the text reads */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, hsl(222 47% 8%) 0%, transparent 16%, transparent 72%, hsl(222 47% 8%) 100%)' }}
      />

      <div className="relative z-10 flex items-center gap-2.5 p-8" aria-hidden="true">
        <LogoMark size={30} className="text-[hsl(222_30%_64%)]" />
        <span className="text-base font-semibold tracking-tight text-white/90">MyCargoLens</span>
      </div>

      <div className="relative z-10 space-y-4 p-8">
        <p className="max-w-sm text-lg font-medium leading-snug tracking-tight text-white/85">{caption}</p>
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {FACTS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-1.5 text-xs text-white/45">
              <Icon size={14} className="text-white/35" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
