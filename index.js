const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/insta', async (req, res) => {
  const instaUrl = req.query.url;
  if (!instaUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ko-KR,ko;q=0.9' });

    await page.goto(instaUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const data = await page.evaluate(() => {
      let content = '내용을 불러올 수 없는 포스트이거나 비공개 계정입니다.';
      let image = '';

      const descMeta = document.querySelector('meta[property="og:description"]') || document.querySelector('meta[name="description"]');
      if (descMeta) {
        content = descMeta.getAttribute('content').split(' - Instagram:')[0].trim();
      } else if (document.title && document.title !== 'Instagram') {
        content = document.title.split('• Instagram 사진 및 동영상')[0].trim();
      }

      const imgMeta = document.querySelector('meta[property="og:image"]');
      if (imgMeta) {
        image = imgMeta.getAttribute('content');
      }

      return { content, image };
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, () => {});
