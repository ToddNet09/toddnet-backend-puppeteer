
const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 10000;

app.post('/medir-fibra', async (req, res) => {
    const { slot, port } = req.body;
    const url = process.env.RADIUS_URL;
    const user = process.env.RADIUS_USER;
    const pass = process.env.RADIUS_PASS;

    try {
        const browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.goto(url.replace("/olt/command", "/login"), { waitUntil: 'networkidle2' });

        await page.type('input[name="email"]', user);
        await page.type('input[name="password"]', pass);
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        await page.goto(url, { waitUntil: 'networkidle2' });
        await page.select('select[name="olt"]', 'Arrecifes');
        await page.type('input[name="slot"]', slot.toString());
        await page.type('input[name="port"]', port.toString());
        await page.select('select[name="command"]', 'onu status');

        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForSelector('table.table')
        ]);

        const result = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table.table tbody tr'));
            return rows.map(row => {
                const cells = row.querySelectorAll('td');
                return {
                    onu: cells[0]?.innerText.trim(),
                    operStatus: cells[1]?.innerText.trim(),
                    rxPowerOlt: cells[2]?.innerText.trim(),
                    rxPowerOnt: cells[3]?.innerText.trim(),
                    distance: cells[4]?.innerText.trim()
                };
            });
        });

        await browser.close();
        res.json({ data: result });
    } catch (error) {
        console.error("Error al medir fibra:", error);
        res.status(500).json({ error: "Fallo al medir fibra" });
    }
});

app.listen(PORT, () => {
    console.log(`ToddNet backend con puppeteer-core activo en puerto ${PORT}`);
});
