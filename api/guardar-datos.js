// Este es el "puente" que se ejecuta en Vercel
// Nombre del archivo: /api/guardar-datos.js

export default async function handler(request, response) {
  // Solo permitir peticiones POST
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const nuevoDato = request.body; // Los datos del afiliado que envía la página
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // El token que guardaste en Vercel
    const REPO_URL = 'https://api.github.com/repos/Gaby-beep/cartilla-medica/contents/cartilla-medica.json';

    // --- Paso 1: Obtener el archivo actual de GitHub ---
    const getFileResponse = await fetch(REPO_URL, {
      method: 'GET',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Gaby-beep-App'
      },
    });

    if (!getFileResponse.ok) {
      if (getFileResponse.status === 404) {
        // Si no existe, crearemos uno nuevo
        console.log('Archivo no encontrado, se creará uno nuevo.');
        const datosIniciales = { afiliados: [], prestaciones: [] };
        
        if (nuevoDato.tipo === 'afiliado') {
          datosIniciales.afiliados.push(nuevoDato.data);
        } else if (nuevoDato.tipo === 'prestacion') {
          datosIniciales.prestaciones.push(nuevoDato.data);
        }

        const crearArchivoResponse = await crearOActualizarArchivo(
          REPO_URL,
          GITHUB_TOKEN,
          datosIniciales,
          'Crear cartilla-medica.json inicial',
          null
        );

        return response.status(201).json({ message: 'Datos guardados (archivo creado)', data: crearArchivoResponse });
      
      } else {
        throw new Error(`Error al obtener el archivo: ${getFileResponse.statusText}`);
      }
    }

    const fileData = await getFileResponse.json();
    const fileContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const fileSha = fileData.sha;
    let datosActuales;
    
    try {
      datosActuales = JSON.parse(fileContent);
    } catch (e) {
      // Si el JSON está vacío o corrupto, empezamos de nuevo
      datosActuales = { afiliados: [], prestaciones: [] };
    }

    // --- Paso 2: Modificar los datos ---
    if (!datosActuales.afiliados) datosActuales.afiliados = [];
    if (!datosActuales.prestaciones) datosActuales.prestaciones = [];

    if (nuevoDato.tipo === 'afiliado') {
      datosActuales.afiliados.push(nuevoDato.data);
    } else if (nuevoDato.tipo === 'prestacion') {
      datosActuales.prestaciones.push(nuevoDato.data);
    } else {
      return response.status(400).json({ message: 'Tipo de dato no reconocido' });
    }

    // --- Paso 3: Subir el archivo actualizado a GitHub ---
    const actualizarArchivoResponse = await crearOActualizarArchivo(
      REPO_URL,
      GITHUB_TOKEN,
      datosActuales,
      `Actualizar datos (nuevo ${nuevoDato.tipo})`,
      fileSha
    );

    response.status(200).json({ message: 'Datos guardados con éxito', data: actualizarArchivoResponse });

  } catch (error) {
    console.error(error);
    response.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
}


// Función ayudante para crear o actualizar el archivo en GitHub
async function crearOActualizarArchivo(url, token, datos, mensajeCommit, sha) {
  const contenidoCodificado = Buffer.from(JSON.stringify(datos, null, 2)).toString('base64');

  const body = {
    message: mensajeCommit,
    content: contenidoCodificado,
    branch: 'main', // Asegúrate que tu rama principal se llame 'main'
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Gaby-beep-App'
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Error al guardar en GitHub: ${response.statusText} - ${errorData.message}`);
  }
  return await response.json();
}
