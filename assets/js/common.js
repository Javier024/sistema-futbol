// ==========================================
// 1. UTILIDADES
// ==========================================
const utils = {
    formatMoney: (amount) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);
    },
    formatDate: (dateStr) => { 
        if(!dateStr) return '-'; 
        return new Date(dateStr).toLocaleDateString('es-CO'); 
    },
    getAge: (birthDate) => {
        if (!birthDate) return 0;
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    },
    getCategory: (age) => {
        // Lógica por defecto si falla la API
        const defaultCats = [
            { id: 1, nombre: 'Pre-Infantil', edad_minima: 6, edad_maxima: 8 },
            { id: 2, nombre: 'Infantil', edad_minima: 9, edad_maxima: 12 },
            { id: 3, nombre: 'Cadete', edad_minima: 13, edad_maxima: 16 },
            { id: 4, nombre: 'Juvenil', edad_minima: 17, edad_maxima: 99 }
        ];
        return defaultCats.find(c => age >= c.edad_minima && age <= c.edad_maxima) || { nombre: 'Libre' };
    }
};

// ==========================================
// 2. LÓGICA FINANCIERA (ANTES FALTANTE)
// ==========================================
const finance = {
    // Calcula el estado de pago de un jugador para el mes actual
    getPlayerStatus: (playerId) => {
        const players = db.data.jugadores || [];
        const payments = db.data.pagos || [];
        const config = db.data.configuracion_sistema || { valor_mensual: 50000 };
        
        const player = players.find(p => p.id == playerId);
        if (!player) return { status: 'unknown', debt: 0, paid: 0 };

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Sumar pagos del mes actual
        const paidAmount = payments
            .filter(p => {
                const d = new Date(p.fecha_pago);
                return p.id_jugador == playerId && 
                       d.getMonth() === currentMonth && 
                       d.getFullYear() === currentYear;
            })
            .reduce((sum, p) => sum + parseInt(p.monto || 0), 0);

        const fee = parseInt(config.valor_mensual);
        const debt = fee - paidAmount;

        let status = 'debt';
        if (debt <= 0) status = 'paid';
        else if (paidAmount > 0) status = 'partial';

        return { status, debt, paid: paidAmount, fee };
    },

    registerPayment: async (playerId, amount, date, method, notes) => {
        const payment = {
            id_jugador: playerId,
            monto: amount,
            fecha_pago: date,
            metodo_pago: method,
            notas: notes
        };
        // Llamada a la API real
        await db.add('pagos', payment);
    }
};

// ==========================================
// 3. CLIENTE API
// ==========================================
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'  
    : '/api';                    

const db = {
    data: {}, // Cache

    async init() { 
        try {
            // Cargar configuración
            const resConfig = await fetch(`${API_URL}/configuracion`);
            if (resConfig.ok) this.data['configuracion_sistema'] = await resConfig.json();
            else this.data['configuracion_sistema'] = { valor_mensual: 50000, moneda: 'COP', nombre_escuela: 'EFUSA' };

            // Cargar categorías
            const resCats = await fetch(`${API_URL}/categorias`);
            if (resCats.ok) this.data['categorias'] = await resCats.json();

            // Precargar jugadores y pagos para cálculos de finanzas
            await this.getAll('jugadores');
            await this.getAll('pagos');
            await this.getAll('gastos');
            await this.getAll('inventario');

        } catch (error) {
            console.error("Error init db:", error);
            showToast('Error conectando al servidor', 'error');
        }
    },

    getAll: async (table) => {
        try {
            // Retornar caché si existe y es reciente
            if (this.data[table]) return this.data[table];
            
            const res = await fetch(`${API_URL}/${table}`);
            if (!res.ok) throw new Error(`Error fetching ${table}`);
            
            const data = await res.json();
            this.data[table] = data;
            return data;
        } catch (error) {
            console.error(`Error cargando ${table}:`, error);
            return [];
        }
    },

    add: async (table, item) => {
        try {
            const res = await fetch(`${API_URL}/${table}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!res.ok) throw new Error('Error al guardar');
            
            const result = await res.json();
            
            // Actualizar caché local inmediatamente
            if (!this.data[table]) this.data[table] = [];
            // Si la API devuelve el ID completo, usarlo, si no simular
            const newItem = { id: result.id || Date.now(), ...item };
            this.data[table].push(newItem);
            
            return newItem;
        } catch (error) {
            console.error("Error guardando:", error);
            showToast('Error de conexión', 'error');
            throw error;
        }
    },

    update: async (table, id, changes) => {
        // Nota: Para simplicidad en este ejemplo, simulamos la actualización en caché 
        // ya que la API no tiene endpoints PUT para todos.
        // En un caso real, aquí haríamos fetch(`${API_URL}/${table}/${id}`, { method: 'PUT'... })
        try {
            // Actualización especial para configuración
            if (table === 'configuracion_sistema') {
                await fetch(`${API_URL}/configuracion`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(changes)
                });
                this.data[table] = { ...this.data[table], ...changes };
                return;
            }
            
            // Actualización genérica en caché (para inventario, etc)
            if (this.data[table]) {
                const idx = this.data[table].findIndex(x => x.id == id);
                if (idx !== -1) {
                    this.data[table][idx] = { ...this.data[table][idx], ...changes };
                }
            }
        } catch (e) {
            console.error("Error actualizando", e);
        }
    },

    delete: async (table, id) => {
        try {
            const res = await fetch(`${API_URL}/${table}/${id}`, { method: 'DELETE' });
            if (res.ok) {
                this.data[table] = this.data[table].filter(i => i.id != id);
                showToast('Eliminado correctamente', 'success');
            }
        } catch (error) {
            console.error("Error eliminando", error);
            showToast('Error al eliminar', 'error');
        }
    },
    
    getById: (table, id) => {
        if(!this.data[table]) return null;
        return this.data[table].find(i => i.id == id);
    }
};

// ==========================================
// 4. UI COMPONENTS
// ==========================================
const showToast = (msg, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div'); 
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => { 
        toast.style.opacity = '0'; 
        setTimeout(() => toast.remove(), 300); 
    }, 3000);
};

const openModal = (title, htmlContent) => {
    const titleEl = document.getElementById('modal-title');
    const contentEl = document.getElementById('modal-content');
    const modalEl = document.getElementById('modal');
    
    if(titleEl) titleEl.innerText = title;
    if(contentEl) contentEl.innerHTML = htmlContent;
    if(modalEl) modalEl.classList.add('active');
};

const closeModal = () => { 
    const modalEl = document.getElementById('modal');
    if(modalEl) modalEl.classList.remove('active');
};

const toggleDarkMode = () => { 
    document.body.classList.toggle('dark-mode'); 
};

const logout = () => { 
    sessionStorage.removeItem('user'); 
    window.location.href = '/index.html'; 
};

const checkAuth = () => {
    if (!sessionStorage.getItem('user')) { 
        window.location.href = '/index.html'; 
        return false; 
    }
    return true;
};

const renderSidebar = (activeId) => {
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
        return `<a href="${item.file}" class="${activeId === item.id ? 'active' : ''}"><i class="fas ${item.icon}" style="width:20px"></i> ${item.label}</a>`;
    }).join('');

    const sidebarHtml = `
        <aside>
            <div class="brand"><i class="fas fa-shield-alt"></i> EFUSA MANAGER</div>
            <nav>${navHtml}</nav>
            <div style="padding: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                <button onclick="toggleDarkMode()" class="btn btn-sm btn-secondary btn-block"><i class="fas fa-moon"></i> Tema</button>
                <button onclick="logout()" class="btn btn-sm btn-danger btn-block" style="margin-top:10px"><i class="fas fa-sign-out-alt"></i> Salir</button>
            </div>
        </aside>
    `;
    
    const placeholder = document.getElementById('sidebar-placeholder');
    if(placeholder) placeholder.innerHTML = sidebarHtml;
};

window.addEventListener('DOMContentLoaded', () => { 
    db.init(); 
});