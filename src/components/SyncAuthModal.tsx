import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { login, register } from '../sync/client';

interface SyncAuthModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful login/register (the caller usually triggers a sync). */
  onSuccess?: () => void;
}

/**
 * Login / register dialog for the sync account. On success the token is
 * persisted by `login`/`register` (in sync/client), then `onSuccess` fires.
 */
export const SyncAuthModal: React.FC<SyncAuthModalProps> = ({ open, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Keep latest callbacks without re-running effects.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (open) {
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const submit = async () => {
    if (loading) return;
    const name = username.trim();
    setError(null);
    if (name.length < 3) {
      setError('用户名至少 3 个字符');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 个字符');
      return;
    }
    setLoading(true);
    try {
      const res = mode === 'login' ? await login(name, password) : await register(name, password);
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setLoading(false);
      onSuccessRef.current?.();
      onCloseRef.current();
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败');
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} ariaLabel="同步账号登录">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">同步账号</h2>
      <p className="text-sm text-gray-500 mb-4">
        登录后，多台设备将共享同一份云端数据。{mode === 'login' ? '首次使用请先注册。' : '注册后将自动创建你的云端空间。'}
      </p>

      <label className="block text-sm text-gray-600 mb-1">用户名</label>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        placeholder="至少 3 个字符"
        className="w-full px-3 py-2.5 mb-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-blue-400 outline-none transition-all"
      />

      <label className="block text-sm text-gray-600 mb-1">密码</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        placeholder="至少 6 个字符"
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        className="w-full px-3 py-2.5 mb-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-blue-400 outline-none transition-all"
      />

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      <button
        onClick={submit}
        disabled={loading}
        className="w-full min-h-[44px] bg-blue-600 text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-60"
      >
        {loading ? '处理中…' : mode === 'login' ? '登录' : '注册'}
      </button>

      <button
        onClick={() => {
          setError(null);
          setMode((m) => (m === 'login' ? 'register' : 'login'));
        }}
        className="w-full mt-3 text-sm text-blue-600 hover:text-blue-700 transition-colors"
      >
        {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
      </button>
    </Modal>
  );
};
