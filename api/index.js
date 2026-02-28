import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { client, initDb } from '../lib/db.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json());

// Servir estáticos
app.use(express.static(path.join(__dirname, '../')));

// Ruta Base
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'API EFUSA Corriendo' }));

// --- ENDPOINTS ---

// Usuarios
app.get('/api/usuarios', async (req, res) => {
  try {
    const result = await client.execute('SELECT * FROM usuarios');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Categorías
app.get('/api/categorias', async (req, res) => {
  try {
    const result = await client.execute('SELECT * FROM categorias');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Configuración
app.get('/api/configuracion', async (req, res) => {
  try {
    const result = await client.execute('SELECT * FROM configuracion_sistema WHERE id = 1');
    if (result.rows.length === 0) {
      return res.json({ valor_mensual: 50000, moneda: 'COP', nombre_escuela: 'EFUSA MANAGER' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/configuracion', async (req, res) => {
    const { nombre_escuela, valor_mensual, moneda } = req.body;
    try {
        await client.execute('UPDATE configuracion_sistema SET nombre_escuela = ?, valor_mensual = ?, moneda = ? WHERE id = 1', [nombre_escuela, valor_mensual, moneda]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CRUD JUGADORES ---

// 1. LEER (GET)
app.get('/api/jugadores', async (req, res) => {
  try {
    const result = await client.execute('SELECT * FROM jugadores ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. CREAR (POST)
app.post('/api/jugadores', async (req, res) => {
  const { nombres, apellidos, fecha_nacimiento, telefono, id_categoria, guardian_name, guardian_phone, tipo_sangre } = req.body;
  
  try {
    let id_acudiente = null;
    if (guardian_name && guardian_phone) {
      // Verificar si el acudiente ya existe por teléfono
      const checkPhone = await client.execute({
        sql: 'SELECT id FROM acudientes WHERE telefono = ?',
        args: [guardian_phone]
      });
      if (checkPhone.rows.length > 0) {
        id_acudiente = checkPhone.rows[0].id;
      } else {
        // Crear nuevo acudiente
        const newAcudiente = await client.execute({
          sql: 'INSERT INTO acudientes (nombre, telefono) VALUES (?, ?)',
          args: [guardian_name, guardian_phone]
        });
        id_acudiente = newAcudiente.meta.last_row_id;
      }
    }

    const result = await client.execute({
      sql: `INSERT INTO jugadores (nombres, apellidos, fecha_nacimiento, telefono, id_categoria, id_acudiente, tipo_sangre) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [nombres, apellidos, fecha_nacimiento, telefono, id_categoria, id_acudiente, tipo_sangre || 'O+']
    });

    res.status(201).json({ id: result.meta.last_row_id });
  } catch (error) {
    console.error("Error guardando jugador:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. ACTUALIZAR (PUT)
app.put('/api/jugadores/:id', async (req, res) => {
  const { nombres, apellidos, fecha_nacimiento, telefono, tipo_sangre, id_categoria, guardian_name, guardian_phone } = req.body;
  const id = req.params.id;
  
  try {
    // 1. Obtener el jugador actual para saber si ya tiene acudiente
    const current = await client.execute({
      sql: 'SELECT id_acudiente FROM jugadores WHERE id = ?',
      args: [id]
    });

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Jugador no encontrado' });
    }

    let id_acudiente = current.rows[0].id_acudiente;

    // 2. Manejar lógica de Acudientes (Crear o Actualizar)
    if (guardian_name && guardian_phone) {
      if (id_acudiente) {
        // Si ya tiene acudiente, actualizamos sus datos
        await client.execute({
          sql: 'UPDATE acudientes SET nombre = ?, telefono = ? WHERE id = ?',
          args: [guardian_name, guardian_phone, id_acudiente]
        });
      } else {
        // Si no tiene, creamos uno nuevo y vinculamos
        const newAcudiente = await client.execute({
          sql: 'INSERT INTO acudientes (nombre, telefono) VALUES (?, ?)',
          args: [guardian_name, guardian_phone]
        });
        id_acudiente = newAcudiente.meta.last_row_id;
      }
    }

    // 3. Actualizar datos del jugador
    await client.execute({
      sql: `UPDATE jugadores 
            SET nombres = ?, apellidos = ?, fecha_nacimiento = ?, telefono = ?, tipo_sangre = ?, id_categoria = ?, id_acudiente = ? 
            WHERE id = ?`,
      args: [nombres, apellidos, fecha_nacimiento, telefono, tipo_sangre, id_categoria, id_acudiente, id]
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error actualizando jugador:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. ELIMINAR (DELETE)
app.delete('/api/jugadores/:id', async (req, res) => {
    try {
        await client.execute('DELETE FROM jugadores WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- FIN CRUD JUGADORES ---

// Pagos
app.get('/api/pagos', async (req, res) => {
  try {
    const result = await client.execute('SELECT * FROM pagos ORDER BY fecha_pago DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pagos', async (req, res) => {
  const { id_jugador, monto, fecha_pago, metodo_pago, notas } = req.body;
  try {
    const result = await client.execute({
      sql: 'INSERT INTO pagos (id_jugador, monto, fecha_pago, metodo_pago, notas) VALUES (?, ?, ?, ?, ?)',
      args: [id_jugador, monto, fecha_pago, metodo_pago, notas]
    });
    res.status(201).json({ id: result.meta.last_row_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/pagos/:id', async (req, res) => {
    try {
        await client.execute('DELETE FROM pagos WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- GASTOS (ACTUALIZADO CON PUT) ---
app.get('/api/gastos', async (req, res) => {
  try {
    const result = await client.execute('SELECT * FROM gastos ORDER BY fecha_gasto DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/gastos', async (req, res) => {
    const { concepto, monto, fecha_gasto, categoria, notas } = req.body;
    try {
        const result = await client.execute({
            sql: 'INSERT INTO gastos (concepto, monto, fecha_gasto, categoria, notas) VALUES (?, ?, ?, ?, ?)',
            args: [concepto, monto, fecha_gasto, categoria, notas]
        });
        res.status(201).json({ id: result.meta.last_row_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NUEVO: ACTUALIZAR GASTO (PUT)
app.put('/api/gastos/:id', async (req, res) => {
    const { concepto, monto, fecha_gasto, categoria, notas } = req.body;
    const id = req.params.id;

    try {
        await client.execute({
            sql: `UPDATE gastos SET concepto = ?, monto = ?, fecha_gasto = ?, categoria = ?, notas = ? WHERE id = ?`,
            args: [concepto, monto, fecha_gasto, categoria, notas, id]
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/gastos/:id', async (req, res) => {
    try {
        await client.execute('DELETE FROM gastos WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Inventario
app.get('/api/inventario', async (req, res) => {
    try {
        const result = await client.execute('SELECT * FROM inventario_items');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/inventario', async (req, res) => {
    const { nombre, categoria, stock, stock_minimo } = req.body;
    try {
        const result = await client.execute({
            sql: 'INSERT INTO inventario_items (nombre, categoria, stock, stock_minimo) VALUES (?, ?, ?, ?)',
            args: [nombre, categoria, stock, stock_minimo]
        });
        res.status(201).json({ id: result.meta.last_row_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/inventario/:id', async (req, res) => {
    const { stock } = req.body;
    try {
        await client.execute('UPDATE inventario_items SET stock = ? WHERE id = ?', [stock, req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ASISTENCIAS ---
app.get('/api/asistencias', async (req, res) => {
  try {
    const result = await client.execute('SELECT * FROM asistencias ORDER BY fecha DESC, id_jugador');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/asistencias', async (req, res) => {
  const records = req.body;
  
  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'El cuerpo de la petición debe ser un array de asistencias' });
  }

  try {
    for (const rec of records) {
        await client.execute({
            sql: `INSERT INTO asistencias (id_jugador, fecha, estado) 
                  VALUES (?, ?, ?) 
                  ON CONFLICT(id_jugador, fecha) 
                  DO UPDATE SET estado = excluded.estado`,
            args: [rec.id_jugador, rec.fecha, rec.estado]
        });
    }
    res.json({ success: true, message: 'Asistencias guardadas' });
  } catch (error) {
    console.error("Error guardando asistencias:", error);
    res.status(500).json({ error: error.message });
  }
});

// Setup inicial
app.get('/api/setup', async (req, res) => {
  try {
    await initDb();
    res.json({ message: 'Base de datos inicializada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor EFUSA corriendo en http://localhost:${PORT}`);
});

export default app;