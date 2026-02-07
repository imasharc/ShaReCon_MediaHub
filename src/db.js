import Gun from 'gun';

// Configure peers here
const peers = [
    'https://gunrelay-production.up.railway.app/gun',
    'http://localhost:8765/gun',
];

export const gun = Gun({ peers });
export const appDB = gun.get('sharecon_app_v2_posts'); // Shared Key