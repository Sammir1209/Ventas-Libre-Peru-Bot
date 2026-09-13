const readline = require('readline');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const apiId = parseInt(process.env.USERBOT_API_ID) || 39784620;
const apiHash = process.env.USERBOT_API_HASH || '3a796fcaf17acd33a60eff68a6363570';

console.log('══════════════════════════════════════════════════════');
console.log('⟡ Generador de Sesión MTProto — Bot Agent');
console.log('══════════════════════════════════════════════════════');
console.log(`API ID:   ${apiId}`);
console.log(`API HASH: ${apiHash}`);
console.log('──────────────────────────────────────────────────────');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const session = new StringSession('');
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      phoneNumber: async () => await ask('📱 Ingresa el número de teléfono con código de país (ej: +51987654321): '),
      password: async () => await ask('🔒 Ingresa tu contraseña de verificación en 2 pasos (2FA si tienes): '),
      phoneCode: async () => await ask('📩 Ingresa el código de 5 dígitos enviado a tu Telegram: '),
      onError: (err) => console.error('Error durante autenticación:', err),
    });

    console.log('\n✓ ¡Conectado exitosamente con Telegram MTProto!');
    const me = await client.getMe();
    console.log(`👤 Sesión iniciada como: ${me.firstName || ''} ${me.lastName || ''} (@${me.username || 'sin_user'}) [ID: ${me.id}]`);

    const sessionString = client.session.save();
    console.log('\n🔑 StringSession generada correctamente:');
    console.log(sessionString);

    // Guardar automáticamente en .env
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('USERBOT_SESSION=')) {
        envContent = envContent.replace(/USERBOT_SESSION=[^\r\n]*/, `USERBOT_SESSION=${sessionString}`);
      } else {
        envContent += `\nUSERBOT_SESSION=${sessionString}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('\n✅ ¡USERBOT_SESSION guardada automáticamente en .env!');
    }

    await client.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error al generar sesión:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
