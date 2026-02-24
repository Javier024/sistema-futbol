import express from 'express';
import cors from 'cors';
import { client, initDb } from '../lib/db.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API Corriendo' });
});

// --- RUTAS DE JUGADORES (MEJORADA PARA TU SQL) ---
app.get('/api/jugadores', async (req, res) => {
  try {
    const result = await client.execute('SELECT * FROM jugadores ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jugadores', async (req, res) => {
  // Recibir todos los datos, incluidos los del acudiente
  const { nombres, apellidos, fecha_nacimiento, telefono, id_categoria, guardian_name, guardian_phone, tipo_sangre } = req.body;
  
  try {
    let id_acudiente = null;

    // 1. Lógica de Acudientes (Tu SQL lo requiere)
    if (guardian_name && guardian_phone) {
      // Buscamos si el acudiente ya existe por el teléfono
      const checkPhone = await client.execute('SELECT id FROM acudientes WHERE telefono = ?', [guardian_phone]);
      
      if (checkPhone.rows.length > 0) {
        // Si ya existe, usamos su ID
        id_acudiente = checkPhone.rows[0].id;
      } else {
        // Si no existe, creamos uno nuevo
        const newAcudiente = await client.execute({
          sql: 'INSERT INTO acudientes (nombre, telefono) VALUES (?, ?)',
          args: [guardian_name, guardian_phone]
        });
        id_acudiente = newAcudiente.meta.last_row_id;
      }
    }

    // 2. Insertar el Jugador
    const result = await client.execute({
      sql: 'INSERT INTO jugadores (nombres, apellidos, fecha_nacimiento, telefono, id_categoria, id_acudiente, tipo_sangre) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [nombres, apellidos, fecha_nacimiento, telefono, id_categoria, id_acudiente, tipo_sangre || 'O+']
    });

    res.status(201).json({ id: result.meta.last_row_id });
  } catch (error) {
    console.error("Error guardando jugador:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- RUTAS DE PAGOS ---
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

// --- SETUP INICIAL ---
app.post('/api/setup', async (req, res) => {
  await initDb();
  res.json({ message: 'Base de datos inicializada' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

export default app;