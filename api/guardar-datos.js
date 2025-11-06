// Este es el "puente" MEJORADO
// Nombre del archivo: /api/guardar-datos.js

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const paquete = request.body; // El paquete que envía React
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
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

    let datosActuales = { afiliados: [], prestaciones: [] };
    let fileSha = null;

    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      fileSha = fileData.sha;
      try {
        const fileContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
        // Evitar que un archivo vacío rompa el JSON.parse
        if (fileContent) {
          datosActuales = JSON.parse(fileContent);
        }
      } catch (e) {
        console.log("JSON vacío o corrupto, iniciando de nuevo.");
      }
    } else if (getFileResponse.status !== 404) {
      // Si no es "No Encontrado", es un error real
      const errorData = await getFileResponse.json();
      console.error('Error al obtener archivo de GitHub:', errorData);
      throw new Error(`Error al obtener el archivo: ${getFileResponse.statusText}`);
    }
    // Si es 404, simplemente usamos datosActuales vacío y fileSha=null

    // Asegurarnos que las listas existan
    if (!datosActuales.afiliados) datosActuales.afiliados = [];
    if (!datosActuales.prestaciones) datosActuales.prestaciones = [];

    // --- Paso 2: Modificar los datos según el "tipo" del paquete ---
    let mensajeCommit = 'Actualizar datos de la cartilla';
    
    switch (paquete.tipo) {
      case 'agregar_afiliado':
        datosActuales.afiliados.push(paquete.data);
        mensajeCommit = 'Agregar nuevo afiliado';
        break;
      case 'agregar_prestacion':
        datosActuales.prestaciones.push(paquete.data);
        mensajeCommit = 'Agregar nueva prestación';
        break;
      case 'eliminar_afiliado':
        datosActuales.afiliados = datosActuales.afiliados.filter(a => a.id !== paquete.data.id);
        // Borrar también sus prestaciones
        datosActuales.prestaciones = datosActuales.prestaciones.filter(p => p.afiliadoId !== paquete.data.id);
        mensajeCommit = 'Eliminar afiliado';
        break;
      case 'eliminar_prestacion':
        datosActuales.prestaciones = datosActuales.prestaciones.filter(p => p.id !== paquete.data.id);
        mensajeCommit = 'Eliminar prestación';
        break;
      default:
        return response.status(400).json({ message: 'Tipo de acción no reconocida' });
    }

    // --- Paso 3: Subir el archivo actualizado a GitHub ---
    const contenidoCodificado = Buffer.from(JSON.stringify(datosActuales, null, 2)).toString('base64');
    
    const putBody = {
      message: mensajeCommit,
      content: contenidoCodificado,
      branch: 'main',
    };
    
    // El SHA es VITAL. Si no lo pasamos en una actualización, falla.
    // Si es un archivo nuevo (fileSha es null), no lo incluimos.
    if (fileSha) {
      putBody.sha = fileSha;
    }

    const putResponse = await fetch(REPO_URL, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Gaby-beep-App'
      },
      body: JSON.stringify(putBody),
    });

    if (!putResponse.ok) {
      const errorData = await putResponse.json();
      console.error('Error al guardar en GitHub:', errorData);
      throw new Error(`Error al guardar en GitHub: ${putResponse.statusText} - ${errorData.message}`);
    }

    const data = await putResponse.json();
    response.status(200).json({ message: 'Datos guardados con éxito', data });

  } catch (error) {
    console.error('Error completo en handler:', error);
    response.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
}
   
