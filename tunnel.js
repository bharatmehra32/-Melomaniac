const localtunnel = require('localtunnel');

async function startTunnel() {
    try {
        const tunnel = await localtunnel({ port: 3000 });
        
        console.log('\n');
        console.log('═══════════════════════════════════════════════════════');
        console.log('🎵 Melomaniac - PUBLIC LINK CREATED! 🎵');
        console.log('═══════════════════════════════════════════════════════');
        console.log('\n✅ Your public URL is:\n');
        console.log(`📱 ${tunnel.url}`);
        console.log('\n✨ Share this link with anyone to access Melomaniac!\n');
        console.log('ℹ️  The link will work as long as this terminal stays open.');
        console.log('ℹ️  Press Ctrl+C to close the tunnel.\n');
        console.log('═══════════════════════════════════════════════════════\n');
        
        tunnel.on('close', () => {
            console.log('🔌 Tunnel closed. Your public link is no longer available.');
        });
    } catch (error) {
        console.error('❌ Error starting tunnel:', error.message);
        process.exit(1);
    }
}

startTunnel();
