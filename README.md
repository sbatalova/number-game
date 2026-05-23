# Числовая Дуэль

Игра: упорядочь числа противника раньше, чем он упорядочит твои.

## Установка и запуск локально

```bash
npm install
npm run dev
```

## Деплой на GitHub Pages

1. Создай репозиторий на GitHub с именем `number-game`

2. Если назвал репо иначе — измени `base` в `vite.config.js`:
   ```js
   base: '/ИМЯ_РЕПОЗИТОРИЯ/',
   ```

3. Инициализируй git и залей код:
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/ТВОй_ЮЗЕРНЕЙМ/number-game.git
   git push -u origin main
   ```

4. Задеплой:
   ```bash
   npm run deploy
   ```

5. В настройках репо на GitHub:  
   **Settings → Pages → Source → выбери ветку `gh-pages`**

Игра будет доступна по адресу:  
`https://ТВОй_ЮЗЕРНЕЙМ.github.io/number-game/`
