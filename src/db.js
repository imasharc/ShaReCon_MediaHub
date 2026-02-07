import Gun from 'gun';

// Define the list based on where the app is running
const peers = window.location.hostname === 'localhost'
    ? ['http://localhost:8765/gun'] // If on your laptop, use ONLY local
    : ['https://gunrelay-production.up.railway.app/gun']; // If on Vercel, use ONLY Railway

export const gun = Gun({ peers });
export const appDB = gun.get('sharecon_app_v2_posts'); // Shared Key