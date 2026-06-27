import { useEffect } from 'react';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    const saved = localStorage.getItem('aiops-theme') || 'blue';
    document.documentElement.dataset.theme = saved;
  }, []);

  return <Component {...pageProps} />;
}
