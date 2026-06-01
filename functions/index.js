const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.database();

async function sendNotificationToToken(token, payload) {
  try {
    const response = await admin.messaging().sendToDevice(token, payload);
    const results = response.results || [];
    const failures = results.filter(r => r.error);

    if (failures.length > 0) {
      console.warn('Tokens inválidos o eliminados:', failures.length);
    }

    return response;
  } catch (error) {
    console.error('Error enviando notificación:', error);
    throw error;
  }
}

async function getTokenForUser(rol, userKey) {
  const snapshot = await db.ref(`tokens/${rol}/${userKey}`).get();
  return snapshot.exists() ? snapshot.val()?.token : null;
}

async function getAllTokensForRole(rol) {
  const snapshot = await db.ref(`tokens/${rol}`).get();
  if (!snapshot.exists()) return [];
  return Object.values(snapshot.val())
    .map(item => item?.token)
    .filter(Boolean);
}

exports.notifyParentOnNewMessage = functions.database
  .ref('/mensajes/padres/{parentKey}/{messageId}')
  .onCreate(async (snapshot, context) => {
    const parentKey = context.params.parentKey;
    const message = snapshot.val();

    const token = await getTokenForUser('padre', parentKey);
    if (!token) {
      console.log(`No hay token FCM para padre ${parentKey}`);
      return null;
    }

    const payload = {
      notification: {
        title: `Nuevo mensaje de ${message.profesor || 'tu colegio'}`,
        body: message.text || 'Tienes un mensaje nuevo de tu profesor',
      },
      data: {
        tipo: 'mensaje',
        destino: parentKey,
        remitente: message.profesor || ''
      }
    };

    return sendNotificationToToken(token, payload);
  });

exports.notifyTeachersOnNewAnnouncement = functions.database
  .ref('/anuncios/{anuncioId}')
  .onCreate(async (snapshot, context) => {
    const anuncio = snapshot.val();
    const tokens = await getAllTokensForRole('profesor');
    if (tokens.length === 0) {
      console.log('No hay tokens FCM guardados para profesores');
      return null;
    }

    const payload = {
      notification: {
        title: 'Nuevo anuncio para profesores',
        body: anuncio.titulo || anuncio.texto || 'Revisa el anuncio nuevo en SchoolDuty',
      },
      data: {
        tipo: 'anuncio',
        anuncioId: context.params.anuncioId || ''
      }
    };

    return admin.messaging().sendToDevice(tokens, payload);
  });
