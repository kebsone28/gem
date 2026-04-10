const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    }
});

async function test() {
    console.log(" TENTATIVE D'ENVOI DE MAIL TEST...");
    console.log(` Serveur: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
    console.log(` Utilisateur: ${process.env.SMTP_USER}`);

    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: "oumarkebe@proquelec.sn",
            subject: " TEST SYSTÈME GEM SAAS - PROQUELEC",
            html: `
            <div style="font-family: Arial; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h1 style="color: #4f46e5;">Connexion Email Réussie !</h1>
                <p>Ceci est un message de test envoyé depuis le serveur <b>GEM SAAS</b> pour valider la configuration Wanekoo.</p>
                <p><b>Statut:</b> Opérationnel</p>
                <hr>
                <p style="font-size: 10px; color: #999;">Envoyé à ${new Date().toLocaleString()}</p>
            </div>`
        });
        console.log(" SUCCÈS : Mail envoyé à oumarkebe@proquelec.sn !");
    } catch (error) {
        console.error(" ÉCHEC :", error.message);
    }
}
test();
