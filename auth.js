import { mostraSchermata } from './ui.js';
import { sincronizzaDalCloud } from './cloud.js';

export function checkPassword() {
    const pass = document.getElementById('password').value;
    if(pass === "pippo") {
        document.getElementById('login-error').classList.add('hidden');
        localStorage.setItem('s8_logged_in', 'true');
        mostraSchermata('screen-main');
        sincronizzaDalCloud();
    } else {
        document.getElementById('login-error').classList.remove('hidden');
    }
}

export function logout() {
    localStorage.removeItem('s8_logged_in');
    document.getElementById('password').value = "";
    mostraSchermata('screen-login');
}