import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

console.log("🚀 Application Starting...");

// Emergency Cleanup: Unregister all service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister().then(() => console.log('SW Unregistered'));
    }
  });
}



try {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error("Root element not found");

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  console.log("✅ React Render Called");

} catch (error) {
  console.error("🔥 FATAL ERROR during React Mount:", error);
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'color:red; padding:20px;';
  const title = document.createElement('h1');
  title.textContent = 'App Crash';
  const detail = document.createElement('pre');
  detail.textContent = String(error);
  wrapper.appendChild(title);
  wrapper.appendChild(detail);
  document.body.appendChild(wrapper);
}
