import React, { useState, useEffect } from 'react';
import { C, FONT, inputStyle } from '../constants';

export function AuthBar({ mode, session, authReady, sync, onLogin, onLogout }) {
  const pill = (bg, color, border, children) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: 999,
        padding: '4px 12px',
        fontSize: 11,
        fontFamily: FONT,
      }}
    >
      {children}
    </span>
  );

  if (mode === 'local') {
    return pill(C.surface, C.muted, C.border, <>💾 บันทึกในเครื่อง (localStorage)</>);
  }
  if (!authReady) return pill(C.surface, C.muted, C.border, <>…</>);

  if (!session) {
    return (
      <button
        onClick={onLogin}
        style={{
          background: C.accent,
          border: 'none',
          color: '#04222b',
          borderRadius: 999,
          padding: '5px 16px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: FONT,
        }}
      >
        เข้าสู่ระบบ / สมัคร
      </button>
    );
  }

  const syncDot =
    sync === 'saving'
      ? { c: C.yellow, t: 'กำลังบันทึก…' }
      : sync === 'error'
      ? { c: C.red, t: 'บันทึกล้มเหลว' }
      : { c: C.green, t: 'ซิงค์แล้ว' };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {pill(
        C.surface,
        C.text,
        C.border,
        <>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: syncDot.c }} />
          {syncDot.t}
        </>
      )}
      {pill(C.surface, C.muted, C.border, <>☁️ {session.user.email}</>)}
      <button
        onClick={onLogout}
        style={{
          background: 'transparent',
          border: `1px solid ${C.border}`,
          color: C.muted,
          borderRadius: 999,
          padding: '4px 12px',
          cursor: 'pointer',
          fontSize: 11,
          fontFamily: FONT,
        }}
      >
        ออก
      </button>
    </div>
  );
}

export function AuthModal({ open, onClose, onSubmit }) {
  const [authMode, setAuthMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail('');
      setPassword('');
      setError('');
      setBusy(false);
      setAuthMode('signin');
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!email || !password) {
      setError('กรอกอีเมลและรหัสผ่าน');
      return;
    }
    setBusy(true);
    setError('');
    const res = await onSubmit(email, password, authMode);
    setBusy(false);
    if (res && res.error) setError(res.error);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: 24,
          width: 'min(400px, 92vw)',
        }}
      >
        <div style={{ fontSize: 16, color: C.text, marginBottom: 4, fontWeight: 700 }}>
          {authMode === 'signup' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
          ข้อมูลพอร์ตจะถูกซิงค์บนคลาวด์ (Supabase)
        </div>
        <input
          type="email"
          value={email}
          placeholder="อีเมล"
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{ ...inputStyle, marginBottom: 10 }}
        />
        <input
          type="password"
          value={password}
          placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
          autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{ ...inputStyle, marginBottom: 10 }}
        />
        {error && (
          <div style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>{error}</div>
        )}
        <button
          onClick={submit}
          disabled={busy}
          style={{
            width: '100%',
            background: C.accent,
            border: 'none',
            color: '#04222b',
            borderRadius: 8,
            padding: '10px',
            cursor: busy ? 'default' : 'pointer',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: FONT,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? '…' : authMode === 'signup' ? 'สมัคร' : 'เข้าสู่ระบบ'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: C.muted }}>
          {authMode === 'signup' ? 'มีบัญชีแล้ว?' : 'ยังไม่มีบัญชี?'}{' '}
          <span
            onClick={() => {
              setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
              setError('');
            }}
            style={{ color: C.accent, cursor: 'pointer' }}
          >
            {authMode === 'signup' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </span>
        </div>
      </div>
    </div>
  );
}
