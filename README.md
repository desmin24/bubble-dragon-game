# Bubble Dragon

Bubble Dragon 是一個手機優先的 Bubble Shooter / 泡泡龍風格小遊戲 MVP，使用 Next.js App Router、TypeScript、React functional components 與 HTML Canvas 實作。專案可直接部署到 Vercel，並使用 `localStorage` 保存最高分。

## 功能列表

- 手機直式優先版面，桌機置中展示
- Canvas 遊戲主畫面
- 上方 HUD 顯示遊戲標題、Score、Best Score、Next Bubble
- 底部 Restart 按鈕與玩法提示：「拖曳瞄準，放開發射」
- 5 種以上立體泡泡顏色
- 觸控與滑鼠拖曳瞄準，放開發射
- 虛線瞄準輔助
- 左右牆反彈
- 泡泡撞到頂部或其他泡泡後吸附到最近格子
- 同色 3 顆以上連結消除並加分
- 失去頂部連結的泡泡會掉落並給予額外分數
- 泡泡接近底部危險線時 Game Over
- Game Over 覆蓋層與 Restart
- 最高分保存於 `localStorage`

## 本機啟動方式

```bash
npm install
npm run dev
```

接著開啟瀏覽器前往：

```text
http://localhost:3000
```

## 建置

```bash
npm run build
```

## 部署方式

1. 將專案推到 GitHub。
2. 在 Vercel 建立新專案並匯入此 repository。
3. Framework Preset 選擇 Next.js。
4. Build Command 使用預設的 `npm run build`。
5. 部署完成後即可取得正式網址。

## 未來可擴充方向

- 音效與背景音樂
- 關卡系統與不同泡泡排列
- 小龍角色造型與發射動畫
- 連擊、特殊泡泡、道具
- 排行榜與分享機制
- 更完整的手機震動回饋與新手教學
