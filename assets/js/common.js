// ==========================================
// 1. BASE DE DATOS Y UTILIDADES
// ==========================================
const DB_KEY = 'futbol_manager_v5_folder';

const initialDB = {
    usuarios: [{ id: 1, correo: 'admin@futbol.com', hash_contrasena: 'admin123', rol: 'admin' }],
    configuracion_sistema: [{ id: 1, valor_mensual: 50000, moneda: 'COP', nombre_escuela: 'Academia de Fútbol Elite', telefono_contacto: '3001234567' }],
    categorias: [
        { id: 1, nombre: 'Pre-Infantil', edad_minima: 6, edad_maxima: 8 },
        { id: 2, nombre: 'Infantil A', edad_minima: 9, edad_maxima: 10 },
        { id: 3, nombre: 'Infantil B', edad_minima: 11, edad_maxima: 12 },
        { id: 4, nombre: 'Cadete', edad_minima: 13, edad_maxima: 14 },
        { id: 5, nombre: 'Juvenil', edad_minima: 15, edad_maxima: 17 },
        { id: 6, nombre: 'Mayores', edad_minima: 18, edad_maxima: 99 }
    ],
    acudientes: [], jugadores: [], pagos: [], aplicacion_pagos: [],
    inventario_items: [
        { id: 1, nombre: 'Balón Fútbol 5', categoria: 'Equipamiento', stock: 10, stock_minimo: 5 },
        { id: 2, nombre: 'Conos', categoria: 'Entrenamiento', stock: 30, stock_minimo: 10 }
    ],
    inventario_movimientos: [], gastos: [], asistencias: [], historial_medico: [], alertas: [], mensajes_enviados: []
};

const db = {
    data: null,
    init() {
        const stored = localStorage.getItem(DB_KEY);
        if (stored) this.data = JSON.parse(stored);
        else { this.data = JSON.parse(JSON.stringify(initialDB)); this.save(); }
        if(this.data.configuracion_sistema[0].darkMode) document.body.classList.add('dark-mode');
    },
    save() { localStorage.setItem(DB_KEY, JSON.stringify(this.data)); },
    getAll(table) { return this.data[table] || []; },
    getById(table, id) { return this.data[table].find(i => i.id == id); },
    add(table, item) {
        if(!item.id) item.id = Date.now() + Math.floor(Math.random()*100);
        if (item.fecha_creacion === undefined) item.fecha_creacion = new Date().toISOString();
        this.data[table].push(item); this.save(); return item;
    },
    update(table, id, newData) {
        const index = this.data[table].findIndex(i => i.id == id);
        if (index !== -1) { this.data[table][index] = { ...this.data[table][index], ...newData }; this.save(); return true; }
        return false;
    },
    delete(table, id) { this.data[table] = this.data[table].filter(i => i.id != id); this.save(); }
};

const utils = {
    formatMoney: (amount) => {
        const config = db.getAll('configuracion_sistema')[0];
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: config.moneda }).format(amount);
    },
    formatDate: (dateStr) => { if(!dateStr) return '-'; return new Date(dateStr).toLocaleDateString('es-CO'); },
    getAge: (birthDate) => {
        const today = new Date(); const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    },
    getCategory: (age) => {
        const cats = db.getAll('categorias').sort((a,b) => a.edad_minima - b.edad_minima);
        return cats.find(c => age >= c.edad_minima && age <= c.edad_maxima) || null;
    }
};

const finance = {
    registerPayment: (playerId, amount, dateStr, method, notes) => {
        const payment = db.add('pagos', { id_jugador: playerId, monto: parseInt(amount), fecha_pago: dateStr, metodo_pago: method, notas: notes });
        let remainingAmount = parseInt(amount);
        const config = db.getAll('configuracion_sistema')[0]; const monthlyFee = parseInt(config.valor_mensual);
        let currentMonth = new Date(); currentMonth.setDate(1); currentMonth.setHours(0,0,0,0);
        for (let i = 0; i < 24; i++) {
            if (remainingAmount <= 0) break;
            const targetMonth = new Date(currentMonth); targetMonth.setMonth(targetMonth.getMonth() + i);
            const y = targetMonth.getFullYear(); const m = targetMonth.getMonth() + 1; 
            const playerApps = db.getAll('aplicacion_pagos').filter(ap => { const p = db.getById('pagos', ap.id_pago); return p && p.id_jugador == playerId && ap.anio === y && ap.mes === m; });
            const alreadyPaid = playerApps.reduce((sum, item) => sum + item.monto_aplicado, 0);
            const needed = monthlyFee - alreadyPaid;
            if (needed > 0) {
                const toApply = Math.min(remainingAmount, needed);
                db.add('aplicacion_pagos', { id_pago: payment.id, anio: y, mes: m, monto_aplicado: toApply });
                remainingAmount -= toApply;
            }
        }
        return payment;
    },
    getPlayerStatus: (playerId) => {
        const config = db.getAll('configuracion_sistema')[0]; const fee = parseInt(config.valor_mensual); const today = new Date(); const currentMonth = today.getMonth() + 1; const currentYear = today.getFullYear();
        const apps = db.getAll('aplicacion_pagos').filter(ap => { const p = db.getById('pagos', ap.id_pago); return p && p.id_jugador == playerId; });
        const paidThisMonth = apps.filter(ap => ap.mes === currentMonth && ap.anio === currentYear).reduce((sum, ap) => sum + ap.monto_aplicado, 0);
        let status = 'debt'; if (paidThisMonth >= fee) status = 'paid'; else if (paidThisMonth > 0) status = 'partial';
        let nextDueDate = null; let searchDate = new Date(); searchDate.setDate(1);
        for(let i=0; i<24; i++){
            const y = searchDate.getFullYear(); const m = searchDate.getMonth() + 1;
            const monthApps = apps.filter(ap => ap.anio === y && ap.mes === m);
            if(monthApps.reduce((s,a) => s + a.monto_aplicado, 0) < fee) { nextDueDate = new Date(y, m-1, 5); break; }
            searchDate.setMonth(searchDate.getMonth() + 1);
        }
        const playerPayments = db.getAll('pagos').filter(p => p.id_jugador == playerId);
        const lastPayment = playerPayments.length ? playerPayments.sort((a,b) => new Date(b.fecha_pago) - new Date(a.fecha_pago))[0] : null;
        return { status, paidThisMonth, debt: Math.max(0, fee - paidThisMonth), fee, nextDueDate, lastPaymentDate: lastPayment ? lastPayment.fecha_pago : null };
    }
};

// ==========================================
// 2. UI Y COMPONENTES GLOBALES
// ==========================================
const showToast = (msg, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div'); toast.className = `toast ${type}`;
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
    const conf = db.getAll('configuracion_sistema')[0];
    db.update('configuracion_sistema', conf.id, { darkMode: document.body.classList.contains('dark-mode') });
};

const logout = () => { sessionStorage.removeItem('user'); window.location.href = '../index.html'; };

const checkAuth = () => {
    if (!sessionStorage.getItem('user')) { window.location.href = '../index.html'; return false; }
    return true;
};

// Renderizar Sidebar Dinámicamente
const renderSidebar = (activeId) => {
    const menu = [
        { id: 'dashboard', icon: 'fa-home', label: 'Dashboard', file: 'dashboard.html' },
        { id: 'jugadores', icon: 'fa-users', label: 'Jugadores', file: 'jugadores.html' },
        { id: 'pagos', icon: 'fa-money-bill-wave', label: 'Pagos', file: 'pagos.html' },
        { id: 'gastos', icon: 'fa-file-invoice-dollar', label: 'Gastos', file: 'gastos.html' },
        { id: 'asistencias', icon: 'fa-clipboard-check', label: 'Asistencias', file: 'asistencias.html' },
        { id: 'inventario', icon: 'fa-boxes', label: 'Inventario', file: 'inventario.html' },
        { id: 'alertas', icon: 'fa-bell', label: 'Alertas', file: 'alertas.html', badgeId: 'alert-count' },
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
            <div class="brand"><i class="fas fa-shield-alt"></i> FUTBOL MANAGER</div>
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
    if (type === 'alertas') {
        const players = db.getAll('jugadores');
        let count = 0;
        players.forEach(p => { const s = finance.getPlayerStatus(p.id); if(s.status !== 'paid') count++; });
        return count;
    }
    return 0;
};

// Inicialización común
window.addEventListener('DOMContentLoaded', () => {
    db.init();
});