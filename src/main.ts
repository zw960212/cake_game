const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const info = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync();

canvas.width = info.windowWidth;
canvas.height = info.windowHeight;
ctx.fillStyle = '#FFF8F0';
ctx.fillRect(0, 0, info.windowWidth, info.windowHeight);
ctx.fillStyle = '#7A5C46';
ctx.font = 'bold 36px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('蛋糕排序派对', info.windowWidth / 2, info.windowHeight / 2);
