import express from 'express';
import cors from 'cors';
import { client, initDb } from '../lib/db.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Permite que tu HTML hable con este servidor
app.use(express.json()); // Permite leer JSON en el cuerpo de las peticiones

// --- RUTAS DE SALUD ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API Corriendo' });
});

// --- RUTAS DE JUGADORES ---
app.get('/api/jugadores', async (req, res) => {
  try {
    const result = await client.execute('SELECT * FROM jugadores ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jugadores', async (req, res) => {
  const { nombres, apellidos, fecha_nacimiento, telefono, id_categoria, id_acudiente, tipo_sangre } = req.body;
  try {
    const result = await client.execute({
      sql: 'INSERT INTO jugadores (nombres, apellidos, fecha_nacimiento, telefono, id_categoria, id_acudiente, tipo_sangre) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [nombres, apellidos, fecha_nacimiento, telefono, id_categoria, id_acudiente || null, tipo_sangre || 'O+']
    });
    res.status(201).json({ id: result.meta.last_row_id });
  } catch (error) {
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

// --- RUTA DE INICIALIZACIÓN (Setup) ---
// Ejecuta esto una vez para crear las tablas
app.post('/api/setup', async (req, res) => {
  await initDb();
  res.json({ message: 'Base de datos inicializada correctamente' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

export default app;