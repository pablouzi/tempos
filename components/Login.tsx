import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Auth state change will be handled in App.tsx
    } catch (error: any) {
      window.Swal.fire({
        icon: 'error',
        title: 'Error de acceso',
        text: 'Credenciales inválidas o error de conexión.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-200">
        <div className="text-center mb-8">
            <div className="bg-coffee-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                ☕
            </div>
            <h2 className="text-3xl font-bold text-gray-800">CaféPOS</h2>
            <p className="text-gray-500">Inicia sesión para continuar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
            <input
              type="email"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-coffee-500 focus:border-coffee-500 sm:text-sm bg-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@cafe.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <input
              type="password"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-coffee-500 focus:border-coffee-500 sm:text-sm bg-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-coffee-600 hover:bg-coffee-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-coffee-500 transition-colors"
          >
            {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : "Ingresar"}
          </button>
        </form>
        
        <p className="mt-6 text-center text-xs text-gray-400">
          Si no tienes cuenta, contacta al administrador.
        </p>
      </div>
    </div>
  );
};

export default Login;