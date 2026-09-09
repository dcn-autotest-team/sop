#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
工业级产品介绍视频生成流水线 (Professional Video Pipeline)
升级特性：
1. 语音引擎：全面升级为微软云端 Neural 神经网络超自然语音 (edge-tts: zh-CN-YunxiNeural)
2. 字幕系统：使用 Pillow 逐帧/逐幕矢量排版渲染 1080P 超清字幕蒙版，带章节标牌、加粗大标题与双行字幕
3. 电影级动效：FFmpeg Ken Burns 镜头推拉与视差微动
4. 视听合流：旁白高清原声 + 智能混流优化，输出 1080P H.264 Web 高速流媒体视频
"""

import os
import sys
import json
import subprocess
import asyncio

# 确保 Windows 终端 UTF-8 打印
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# 目录准备
ROOT_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT_DIR / "assets"
PUBLIC_DIR = ROOT_DIR / "public" / "assets"
TEMP_DIR = ASSETS_DIR / "video_pro_temp"
TEMP_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

# 字体配置 (Windows 微软雅黑)
FONT_BOLD_PATH = "C:/Windows/Fonts/msyhbd.ttc"
FONT_REG_PATH = "C:/Windows/Fonts/msyh.ttc"

FONT_TAG = ImageFont.truetype(FONT_BOLD_PATH, 24)
FONT_TITLE = ImageFont.truetype(FONT_BOLD_PATH, 48)
FONT_SUBTITLE = ImageFont.truetype(FONT_REG_PATH, 28)

SCENES = [
    {
        "id": "scene1",
        "image": "sop-hero-banner.jpg",
        "tag": "01 / 行业痛点与挑战",
        "title": "告别上下文丢失与重复返工",
        "sub_line1": "不同 AI 换个窗口就忘记规约、反复返工？",
        "sub_line2": "项目的最佳实践经验，总是难以在智能体之间高效传承？",
        "voice_text": "你是否遇到过，不同 AI 换个窗口就忘记规约、反复返工？项目的最佳实践经验，总是难以在智能体之间高效传承？"
    },
    {
        "id": "scene2",
        "image": "cmd-start.jpg",
        "tag": "02 / 极简开工对齐",
        "title": "一句话自动对齐历史工程规约",
        "sub_line1": "开工只需一句话，新 Agent 秒级对齐最佳实践",
        "sub_line2": "严格遵守 0-1 破局路径、避坑清单与开发铁律",
        "voice_text": "告别繁琐文档！开工只需一句话，新 Agent 即可秒级对齐历史规约，严格遵守避坑清单与核心开发铁律。"
    },
    {
        "id": "scene3",
        "image": "cmd-finish.jpg",
        "tag": "03 / 完工全自动沉淀",
        "title": "一键萃取破局经验 · 秒级自愈入库",
        "sub_line1": "完工对 Agent 说一句话，自动提炼避坑铁律与 0-1 步骤",
        "sub_line2": "自动提交 PR 与云端自愈合并，全程无需手动复制",
        "voice_text": "项目完工，同样只需一句话，全自动提炼破局经验与步骤，云端秒级自愈合并入库，全程无需手动复制！"
    },
    {
        "id": "scene4",
        "image": "fde-platform.jpg",
        "tag": "04 / 产业级算力底座",
        "title": "神州鲲泰 FDE 智算与企业级 AI 赋能",
        "sub_line1": "面向企业真实场景的产业级 AI 落地支撑",
        "sub_line2": "知识规约与全栈智算算力底座双轮驱动",
        "voice_text": "更有神州鲲泰 FDE 开发者平台深度赋能，提供产业级智算与企业级落地支撑，让知识规约与算力底座双轮驱动。"
    },
    {
        "id": "scene5",
        "image": "sop-hero-banner.jpg",
        "tag": "05 / 人机协同新范式",
        "title": "SOP 誊录馆 · 复杂的留给智能体，你只用一句话",
        "sub_line1": "开源规约托管 · 跨 Agent 随取随用 · 永久沉淀",
        "sub_line2": "即刻访问 dcn-autotest-team.github.io/sop",
        "voice_text": "SOP 誊录馆，把复杂的留给智能体，你只用一句话。即刻访问，开启人机协同新范式！"
    }
]

def generate_subtitle_overlay(scene, out_png):
    """使用 Pillow 生成 1920x1080 的高清透明字幕蒙版 (含磨砂衬底、朱红标牌、金色大标题与白字字幕)"""
    img = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. 顶部左侧：精美章节胶囊标牌 (Tag Pill)
    tag_x, tag_y = 90, 70
    tag_bbox = draw.textbbox((tag_x, tag_y), scene["tag"], font=FONT_TAG)
    padding_x, padding_y = 18, 8
    pill_rect = [tag_bbox[0] - padding_x, tag_bbox[1] - padding_y, tag_bbox[2] + padding_x, tag_bbox[3] + padding_y]
    draw.rounded_rectangle(pill_rect, radius=6, fill=(176, 58, 46, 235), outline=(255, 255, 255, 80), width=1)
    draw.text((tag_x, tag_y), scene["tag"], font=FONT_TAG, fill=(255, 255, 255, 255))

    # 2. 底部半透明深色磨砂字幕卡片 (宽 1740，高 230，居中)
    card_x0, card_y0 = 90, 810
    card_x1, card_y1 = 1830, 1030
    draw.rounded_rectangle([card_x0, card_y0, card_x1, card_y1], radius=16, fill=(18, 15, 12, 215), outline=(226, 132, 122, 100), width=2)

    # 3. 字幕大标题 (金色高亮)
    title_text = scene["title"]
    draw.text((card_x0 + 40, card_y0 + 26), title_text, font=FONT_TITLE, fill=(245, 215, 145, 255))

    # 4. 双行字幕解说词 (白字 / 象牙白)
    sub1 = scene["sub_line1"]
    sub2 = scene["sub_line2"]
    draw.text((card_x0 + 42, card_y0 + 96), sub1, font=FONT_SUBTITLE, fill=(240, 235, 225, 245))
    draw.text((card_x0 + 42, card_y0 + 142), sub2, font=FONT_SUBTITLE, fill=(205, 195, 180, 235))

    img.save(out_png, "PNG")
    print(f"    [Overlay] 已生成高清字幕贴图: {out_png.name}")

async def synthesize_audio(text, out_mp3):
    """调用微软云端 Neural 神经网络语音 (zh-CN-YunxiNeural 沉稳自然男声)"""
    import edge_tts
    proxies = ["http://127.0.0.1:7890", None]
    for p in proxies:
        try:
            communicate = edge_tts.Communicate(text, voice="zh-CN-YunxiNeural", rate="+2%", pitch="+0Hz", proxy=p)
            await communicate.save(str(out_mp3))
            if os.path.exists(out_mp3) and os.path.getsize(out_mp3) > 1000:
                return
        except Exception as e:
            continue
    # 若重试未成功抛出异常
    raise RuntimeError(f"Edge TTS 合成语音失败: {text[:20]}")

def get_audio_duration(file_path):
    """使用 ffprobe 获取音频时长"""
    cmd = f'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "{file_path}"'
    res = subprocess.check_output(cmd, shell=True, text=True).strip()
    return float(res)

async def main():
    print("=== SOP 誊录馆 · 电影级产品介绍视频自动化生产中 (Edge Neural TTS + Subtitles) ===")

    scene_clips = []

    for idx, sc in enumerate(SCENES):
        print(f"\n>>> 正在处理第 [{idx + 1}/{len(SCENES)}] 幕: {sc['title']}")
        
        # 1. 合成微软超自然神经网络语音
        audio_mp3 = TEMP_DIR / f"{sc['id']}.mp3"
        print(f"    [TTS] 正在合成微软 Neural 语音: \"{sc['voice_text'][:22]}...\"")
        await synthesize_audio(sc["voice_text"], audio_mp3)
        duration = get_audio_duration(audio_mp3)
        scene_dur = round(duration + 0.85, 2)
        print(f"    [Audio] 音频时长: {duration:.2f}s | 视频幕长: {scene_dur:.2f}s")

        # 2. 生成高清字幕蒙版图
        overlay_png = TEMP_DIR / f"{sc['id']}_sub.png"
        generate_subtitle_overlay(sc, overlay_png)

        # 3. 使用 FFmpeg 进行 Ken Burns 推拉与字幕图层叠加
        img_path = ASSETS_DIR / sc["image"]
        clip_mp4 = TEMP_DIR / f"{sc['id']}_clip.mp4"
        
        total_frames = int(scene_dur * 25)
        # 交替镜头动效：奇数镜头微推近放大，偶数镜头向右上微平移
        if idx % 2 == 0:
            zoom_filter = f"scale=1920:1080,zoompan=z='min(zoom+0.00032,1.09)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1920x1080:fps=25"
        else:
            zoom_filter = f"scale=1920:1080,zoompan=z='min(zoom+0.00028,1.07)':x='iw*0.48':y='ih*0.48':d={total_frames}:s=1920x1080:fps=25"

        ffmpeg_cmd = (
            f'ffmpeg -y -loop 1 -t {scene_dur} -i "{img_path}" -i "{overlay_png}" -i "{audio_mp3}" '
            f'-filter_complex "[0:v]{zoom_filter}[bg];[bg][1:v]overlay=0:0:format=auto[v]" '
            f'-map "[v]" -map 2:a -c:v libx264 -preset fast -crf 21 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "{clip_mp4}"'
        )
        subprocess.check_call(ffmpeg_cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"    [Render] 分幕微电影完成: {clip_mp4.name}")
        scene_clips.append(clip_mp4)

    # 4. 拼接全部分幕
    print("\n>>> [Concat] 正在进行分幕无缝平滑拼接...")
    concat_txt = TEMP_DIR / "concat.txt"
    with open(concat_txt, "w", encoding="utf-8") as f:
        for clip in scene_clips:
            clean_p = str(clip).replace("\\", "/")
            f.write(f"file '{clean_p}'\n")

    final_assets_mp4 = ASSETS_DIR / "sop-product-intro.mp4"
    final_public_mp4 = PUBLIC_DIR / "sop-product-intro.mp4"

    concat_cmd = (
        f'ffmpeg -y -f concat -safe 0 -i "{concat_txt}" '
        f'-movflags +faststart -c:v libx264 -crf 22 -preset medium -c:a aac -b:a 160k "{final_assets_mp4}"'
    )
    subprocess.check_call(concat_cmd, shell=True, stdout=subprocess.DEVNULL)

    # 同步至 public
    import shutil
    shutil.copy(final_assets_mp4, final_public_mp4)

    file_size_mb = os.path.getsize(final_assets_mp4) / (1024 * 1024)
    print("\n==================================================================")
    print(f"[Success] 超清中文字幕 + 微软自然神经网络语音产品介绍视频渲染完成！")
    print(f"[Archive] 本地归档: {final_assets_mp4} ({file_size_mb:.2f} MB)")
    print(f"[Public] 网页分发: {final_public_mp4}")
    print("==================================================================")

if __name__ == "__main__":
    asyncio.run(main())
