// ==========================================
// 1. CONFIGURACIÓN Y UTILIDADES
// ==========================================

// Detectar si estamos en Local o en Vercel para la URL de la API
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'  // URL local (tu PC)
    : '/api';                     // URL Vercel (producción)

const utils = {
    formatMoney: (amount) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);
    },
    formatDate: (dateStr) => { 
        if(!dateStr) return '-'; 
        return new Date(dateStr).toLocaleDateString('es-CO'); 
    },
    getAge: (birthDate) => {
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    }
};

// ==========================================
// 2. INTERFAZ DE BASE DE DATOS (MOCK API)
// ==========================================

const db = {
    data: {}, // Ya no usamos localStorage, usaremos la API
    
    // Ya no inicializamos datos locales, iniciamos sesión
    async init() {
        console.log("Frontend iniciado. Conectando a API:", API_URL);
    },

    // OBTENER DATOS (GET)
    getAll: async (table) => {
        try {
            if (table === 'jugadores') {
                const res = await fetch(`${API_URL}/jugadores`);
                if (!res.ok) throw new Error('Error al conectar con el servidor');
                const data = await res.json();
                return data; // Devuelve el array de jugadores
            }
            if (table === 'pagos') {
                const res = await fetch(`${API_URL}/pagos`);
                const data = await res.json();
                return data;
            }
            if (table === 'configuracion_sistema') {
                // Simulamos esto localmente para no hacer peticiones extra por ahora
                return [{ id: 1, valor_mensual: 50000, moneda: 'COP', nombre_escuela: 'EFUSA' }];
            }
            if (table === 'categorias') {
                 // Simulamos categorías localmente para agilizar
                return [
                    { id: 1, nombre: 'Pre-Infantil', edad_minima: 6, edad_maxima: 8 },
                    { id: 2, nombre: 'Infantil', edad_minima: 9, edad_maxima: 12 },
                    { id: 3, nombre: 'Cadete', edad_minima: 13, edad_maxima: 16 }
                ];
            }
            return [];
        } catch (error) {
            console.error("Error cargando datos:", error);
            showToast('Error al cargar datos del servidor', 'error');
            return [];
        }
    },

    // GUARDAR DATOS (POST)
    add: async (table, item) => {
        try {
            if (table === 'jugadores') {
                const res = await fetch(`${API_URL}/jugadores`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });
                if (!res.ok) throw new Error('Error al guardar jugador');
                showToast('Jugador guardado en la Nube');
                return item;
            }
            if (table === 'pagos') {
                const res = await fetch(`${API_URL}/pagos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });
                if (!res.ok) throw new Error('Error al registrar pago');
                showToast('Pago registrado en la Nube');
                return item;
            }
            // Para otras tablas que aún no tienen API en el backend, usamos local temporalmente
            console.warn(`Tabla ${table} aún no conectada a API, usando localStorage temporal`);
            return item; 
        } catch (error) {
            console.error("Error guardando datos:", error);
            showToast('Error de conexión con el servidor', 'error');
            throw error;
        }
    },

    // Placeholder para otras funciones
    update: async (table, id, newData) => { /* Implementar después */ },
    delete: async (table, id) => { /* Implementar después */ },
    getById: (table, id) => { /* Implementar buscando en el array getAll */ }
};

// ==========================================
// 3. COMPONENTES UI
// ==========================================

const showToast = (msg, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div'); 
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
};

const openModal = (title, htmlContent) => {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-content').innerHTML = htmlContent;
    document.getElementById('modal').classList.add('active');
};

const closeModal = () => { document.getElementById('modal').classList.remove('active'); };

const toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
};

const logout = () => { sessionStorage.removeItem('user'); window.location.href = '../index.html'; };

const checkAuth = () => {
    if (!sessionStorage.getItem('user')) { window.location.href = '../index.html'; return false; }
    return true;
};

const renderSidebar = (activeId) => {
    // ... (Código del sidebar igual que antes, manténlo igual)
    const menu = [
        { id: 'dashboard', icon: 'fa-home', label: 'Dashboard', file: 'dashboard.html' },
        { id: 'jugadores', icon: 'fa-users', label: 'Jugadores', file: 'jugadores.html' },
        { id: 'pagos', icon: 'fa-money-bill-wave', label: 'Pagos', file: 'pagos.html' },
        { id: 'gastos', icon: 'fa-file-invoice-dollar', label: 'Gastos', file: 'gastos.html' },
        { id: 'asistencias', icon: 'fa-clipboard-check', label: 'Asistencias', file: 'asistencias.html' },
        { id: 'inventario', icon: 'fa-boxes', label: 'Inventario', file: 'inventario.html' },
        { id: 'alertas', icon: 'fa-bell', label: 'Alertas', file: 'alertas.html' },
        { id: 'reportes', icon: 'fa-file-excel', label: 'Reportes', file: 'reportes.html' },
        { id: 'configuracion', icon: 'fa-cogs', label: 'Configuración', file: 'configuracion.html' }
    ];

    const navHtml = menu.map(item => {
        let badgeHtml = '';
        if (item.badgeId) {
            const count = calculateBadge(item.id);
            if (count > 0) badgeHtml = `<span id="${item.badgeId}" class="badge bg-red">${count}</span>`;
        }
        return `<a href="${item.file}" class="${activeId === item.id ? 'active' : ''}"><span><i class="fas ${item.icon}"></i> ${item.label}</span>${badgeHtml}</a>`;
    }).join('');

    const sidebarHtml = `
        <aside>
            <div class="brand"><i class="fas fa-shield-alt"></i> EFUSA MANAGER</div>
            <nav>${navHtml}</nav>
            <div class="user-profile">
                <div><i class="fas fa-user-circle"></i> <span>Admin</span></div>
                <div style="margin-top:10px; display:flex; gap:10px;">
                    <button onclick="toggleDarkMode()" title="Modo Oscuro/Claro"><i class="fas fa-moon"></i></button>
                    <button onclick="logout()" title="Salir"><i class="fas fa-sign-out-alt"></i></button>
                </div>
            </div>
        </aside>
    `;
    document.getElementById('sidebar-placeholder').innerHTML = sidebarHtml;
};

const calculateBadge = (type) => {
    if (type === 'alertas') return 0; // Simplificado
    return 0;
};

window.addEventListener('DOMContentLoaded', () => {
    db.init();
});