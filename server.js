// 1. IMPORTACIONES

// Importo el framework Express, el cual me permite crear el servidor
// y definir rutas HTTP de manera sencilla.
const express = require('express');

// Importo Low desde lowdb, que es la base de datos file-based
// que utilizaré para almacenar la información en formato JSON.
const { Low } = require('lowdb');

// Importo el adaptador JSONFile, que permite que Lowdb
// guarde la información en un archivo físico llamado db.json.
const { JSONFile } = require('lowdb/node');


// 2. CONFIGURACIÓN DE LOWDB (Base de datos)

// Defino la estructura inicial de mi base de datos.
// En este caso, será un objeto con una propiedad "actividades"
// que contiene un arreglo vacío.
const defaultData = { actividades: [] };

// Creo el adaptador que se encargará de conectar Lowdb
// con el archivo físico db.json.
const adapter = new JSONFile('db.json');

// Inicializo la base de datos pasando el adaptador
// y los datos por defecto.
const db = new Low(adapter, defaultData);


// 3. INICIALIZAR (leer datos existentes o crear archivo)

// Creo una función asíncrona para inicializar la base de datos.
// Esta función se ejecuta al iniciar el servidor.
async function initDb() {
  
  // Leo el archivo db.json si ya existe.
  await db.read();

  // Si no existen datos, significa que el archivo
  // aún no tiene estructura, entonces asigno los datos por defecto.
  if (!db.data) {
    db.data = defaultData;

    // Escribo en el archivo para crear físicamente db.json.
    await db.write();
  }
}

// Ejecuto la función de inicialización.
initDb();


// 4. CONFIGURACIÓN EXPRESS

// Creo la aplicación Express.
const app = express();

// Activo el middleware express.json() para que el servidor
// pueda interpretar datos en formato JSON enviados en el body.
app.use(express.json());


// Middleware para registrar cada petición

// Este middleware me permite visualizar en consola
// cada petición que recibe el servidor, mostrando:
// - Fecha
// - Método HTTP
// - URL solicitada
app.use((req, res, next) => {
  const fecha = new Date().toISOString();
  console.log(`📥 [${fecha}] ${req.method} ${req.url}`);
  
  // Escucho cuando la respuesta termina para mostrar
  // el código de estado HTTP que se envió al cliente.
  res.on('finish', () => {
    console.log(`📤 Estado de respuesta: ${res.statusCode}`);
    console.log('-----------------------------------');
  });

  next(); // Continúo con la siguiente función middleware o ruta.
});


// 5. RUTA DE PRUEBA (GET /)

// Defino una ruta básica para verificar que el servidor está funcionando.
// Cuando el cliente accede a "/", responde con un mensaje simple.
app.get('/', (req, res) => {
  res.send('¡Servidor funcionando! 🚀');
});


// 6. OBTENER TODAS LAS ACTIVIDADES (GET /api/actividades)

// Esta ruta permite consultar todas las actividades almacenadas.
app.get('/api/actividades', async (req, res) => {

  // Primero leo la base de datos para asegurarme
  // de trabajar con la información más actual.
  await db.read();

  // Devuelvo el arreglo completo de actividades en formato JSON.
  res.json(db.data.actividades);
});


// 7. OBTENER UNA ACTIVIDAD ESPECÍFICA (GET /api/actividades/:id)

// Esta ruta permite buscar una actividad por su ID.
app.get('/api/actividades/:id', async (req, res) => {

  await db.read();

  // Obtengo el ID desde los parámetros de la URL.
  // Uso parseInt para convertirlo de string a número,
  // ya que los parámetros llegan como texto.
  const id = parseInt(req.params.id);

  // Busco la actividad que coincida con ese ID.
  const actividad = db.data.actividades.find(a => a.id === id);
  
  // Si no se encuentra la actividad, retorno error 404.
  if (!actividad) {
    return res.status(404).json({ error: 'Recurso inexistente' });
  }

  // Si existe, la retorno al cliente.
  res.json(actividad);
});


// 8. CREAR NUEVA ACTIVIDAD (POST /api/actividades)

// Esta ruta permite crear una nueva actividad.
app.post('/api/actividades', async (req, res) => {

  await db.read();

  // Creo el objeto nuevaActividad con:
  // - Un ID único generado con Date.now()
  // - Título recibido desde el body
  // - Estado completada con valor por defecto false
  const nuevaActividad = {
    id: Date.now(),
    titulo: req.body.titulo,
    completada: req.body.completada || false
  };

  // Valido que el título exista y tenga mínimo 3 caracteres.
  if (!nuevaActividad.titulo || nuevaActividad.titulo.trim().length < 3) {
    return res.status(400).json({ 
      error: 'El titulo debe tener al menos 3 caracteres' 
    });
  }

  // Elimino espacios en blanco innecesarios.
  nuevaActividad.titulo = nuevaActividad.titulo.trim();
  
  // Agrego la nueva actividad al arreglo.
  db.data.actividades.push(nuevaActividad);

  // Escribo los cambios en el archivo db.json
  // para garantizar persistencia.
  await db.write();
  
  // Devuelvo la actividad creada con código 201 (Created).
  res.status(201).json(nuevaActividad);
});


// 9. ACTUALIZAR ACTIVIDAD (PUT /api/actividades/:id)

// Esta ruta permite actualizar una actividad existente.
app.put('/api/actividades/:id', async (req, res) => {

  await db.read();

  const id = parseInt(req.params.id);

  // Busco el índice de la actividad dentro del arreglo.
  const index = db.data.actividades.findIndex(a => a.id === id);
  
  // Si no se encuentra, retorno 404.
  if (index === -1) {
    return res.status(404).json({ error: 'Actividad no encontrada' });
  }

  // Valido que si se envía un nuevo título,
  // este tenga al menos 3 caracteres.
  if (req.body.titulo && req.body.titulo.trim().length < 3) {
    return res.status(400).json({ 
      error: 'El titulo debe tener al menos 3 caracteres' 
    });
  }
  
  // Actualizo la actividad usando el operador spread (...)
  // para conservar los datos anteriores y sobrescribir
  // únicamente los que se envían en el body.
  db.data.actividades[index] = {
    ...db.data.actividades[index],
    ...req.body,
    id: id
  };
  
  // Guardo los cambios en el archivo.
  await db.write();

  // Retorno la actividad actualizada.
  res.json(db.data.actividades[index]);
});


// 10. ELIMINAR ACTIVIDAD (DELETE /api/actividades/:id)

// Esta ruta permite eliminar una actividad.
app.delete('/api/actividades/:id', async (req, res) => {

  await db.read();

  const id = parseInt(req.params.id);

  // Busco la posición de la actividad.
  const index = db.data.actividades.findIndex(a => a.id === id);
  
  // Si no existe, retorno 404.
  if (index === -1) {
    return res.status(404).json({ error: 'Actividad no encontrada' });
  }
  
  // Elimino la actividad del arreglo usando splice.
  const actividadEliminada = db.data.actividades.splice(index, 1);

  // Guardo los cambios para que la eliminación sea persistente.
  await db.write();
  
  // Retorno mensaje de confirmación.
  res.json({ 
    mensaje: 'Actividad eliminada', 
    actividad: actividadEliminada[0] 
  });
});


// 11. INICIAR SERVIDOR

// Defino el puerto donde correrá el servidor.
const PORT = 3000;

// Inicio el servidor y muestro mensajes en consola.
app.listen(PORT, () => {
  console.log(`✅ Servidor activo en http://localhost:${PORT}`);
  console.log(`💾 Base de datos: db.json`);
});
