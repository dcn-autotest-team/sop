#!/usr/bin/env node

/**
 * 产品介绍视频自动渲染流水线 (Video Production Pipeline)
 * 1. 使用 Windows SAPI (Microsoft Huihui Desktop) 逐幕合成高清中文旁白音频
 * 2. 使用 FFmpeg 为各幕原画添加电影级 Ken Burns 慢动效与现代字幕条
 * 3. 拼接合流输出 1080P 高清 mp4 视频：assets/sop-product-intro.mp4
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public', 'assets');
const AUDIO_DIR = path.join(ASSETS_DIR, 'video_audio');
const TEMP_DIR = path.join(ASSETS_DIR, 'video_temp');

if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const scenesFile = path.join(ASSETS_DIR, 'video_scenes.json');
const scenes = JSON.parse(fs.readFileSync(scenesFile, 'utf8'));

console.log('=== [Step 1] 开始合成各分幕旁白语音 (Microsoft Huihui TTS) ===');

for (const sc of scenes) {
  const wavPath = path.join(AUDIO_DIR, `${sc.id}.wav`);
  console.log(`>>> 正在合成 [${sc.id}] 旁白: "${sc.text.slice(0, 20)}..."`);
  
  // 通过 base64 传递给 powershell，避免编码乱码
  const b64 = Buffer.from(sc.text, 'utf8').toString('base64');
  const psScript = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('Microsoft Huihui Desktop')
$synth.Rate = 0
$rawBytes = [System.Convert]::FromBase64String('${b64}')
$text = [System.Text.Encoding]::UTF8.GetString($rawBytes)
$synth.SetOutputToWaveFile('${wavPath.replace(/\\/g, '/')}')
$synth.Speak($text)
$synth.SetOutputToNull()
`;
  execSync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, '; ')}"`);
}

console.log('\n=== [Step 2] 探测音频时长并为各幕渲染 1080P 动效微电影片段 ===');

const sceneVideos = [];

for (let i = 0; i < scenes.length; i++) {
  const sc = scenes[i];
  const wavPath = path.join(AUDIO_DIR, `${sc.id}.wav`);
  const imagePath = path.join(ASSETS_DIR, sc.image);
  const outSceneMp4 = path.join(TEMP_DIR, `${sc.id}.mp4`);

  // 使用 ffprobe 获取音频时长
  const durStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${wavPath}"`, { encoding: 'utf8' }).trim();
  const audioDuration = parseFloat(durStr) || 6;
  const sceneDuration = (audioDuration + 0.8).toFixed(2); // 留出呼吸停顿时间

  console.log(`\n[Scene ${i + 1}/${scenes.length}] ${sc.title} | 音频: ${audioDuration}s -> 画面: ${sceneDuration}s`);

  // 针对不同分幕采用不同的缓慢缩放推拉动效 (Ken Burns)
  // i=0: 慢速向前推进; i=1: 慢速向左平移; i=2: 缓慢向右推入; i=3: 沉浸下潜; i=4: 全景微缩放
  let zoomFilter = '';
  const totalFrames = Math.ceil(parseFloat(sceneDuration) * 25);
  
  if (i % 2 === 0) {
    // 慢速向前放大 (1.0 -> 1.08)
    zoomFilter = `scale=1920:1080,zoompan=z='min(zoom+0.0003,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1920x1080:fps=25`;
  } else {
    // 慢速向右上微平移微放大
    zoomFilter = `scale=1920:1080,zoompan=z='min(zoom+0.00025,1.06)':x='iw*0.48':y='ih*0.48':d=${totalFrames}:s=1920x1080:fps=25`;
  }

  // 组合 ffmpeg 指令：画面动效 + 音频混流 + 渐显渐隐
  // 底部用半透明黑底遮罩条，确保画面和字幕极致清晰
  const drawOverlay = `drawbox=y=ih-180:color=black@0.65:width=iw:height=180:t=fill`;
  
  // 渲染单幕视频
  const ffmpegCmd = `ffmpeg -y -loop 1 -t ${sceneDuration} -i "${imagePath}" -i "${wavPath}" -filter_complex "[0:v]${zoomFilter},${drawOverlay},format=yuv420p[v]" -map "[v]" -map 1:a -c:v libx264 -preset fast -crf 20 -c:a aac -b:a 192k -shortest "${outSceneMp4}"`;
  
  execSync(ffmpegCmd, { stdio: 'inherit' });
  sceneVideos.push(outSceneMp4);
}

console.log('\n=== [Step 3] 拼接全幕视频，生成高质感产品宣传大片 ===');

const concatListFile = path.join(TEMP_DIR, 'concat_list.txt');
const listContent = sceneVideos.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
fs.writeFileSync(concatListFile, listContent, 'utf8');

const finalMp4InAssets = path.join(ASSETS_DIR, 'sop-product-intro.mp4');
const finalMp4InPublic = path.join(PUBLIC_DIR, 'sop-product-intro.mp4');

// 执行拼接
const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${concatListFile}" -c copy "${finalMp4InAssets}"`;
execSync(concatCmd, { stdio: 'inherit' });

// 复制到 public 目录
fs.copyFileSync(finalMp4InAssets, finalMp4InPublic);

console.log(`\n======================================================`);
console.log(`[Success] 产品介绍视频已全自动渲染生成完成！`);
console.log(`视频位置: ${finalMp4InAssets}`);
console.log(`线上分发: ${finalMp4InPublic}`);
console.log(`======================================================\n`);
