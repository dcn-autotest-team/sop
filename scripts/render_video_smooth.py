#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
SOP 誊录馆 · 电影级极简产品宣传视频渲染流水线 (Smooth Motion + BGM + Neural Voice)
核心突破：
1. 丝滑运镜：Python Lanczos 浮点平滑插值，彻底消除 FFmpeg zoompan 的像素抖动，支持 30fps 电影级缓动运镜
2. 背景音乐：混入免版权高质量商业科技氛围音乐 (bgm-technology.mp3)，带智能音量均衡与开头结尾平滑淡入淡出
3. 专业旁白：微软云端 Neural 神经网络超自然语音 (zh-CN-YunxiNeural)
4. 前景字幕：UI 独立浮层矢量抗锯齿渲染，固定在画面底部，稳定易读不晃眼
5. 流媒体封包：输出 1080P Web 高速流媒体 MP4 (+faststart)
"""

import os
import sys
import math
import subprocess
import asyncio
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

ROOT_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT_DIR / "assets"
PUBLIC_DIR = ROOT_DIR / "public" / "assets"
TEMP_DIR = ASSETS_DIR / "video_smooth_temp"
TEMP_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

# 微软雅黑字体
FONT_BOLD_PATH = "C:/Windows/Fonts/msyhbd.ttc"
FONT_REG_PATH = "C:/Windows/Fonts/msyh.ttc"

FONT_TAG = ImageFont.truetype(FONT_BOLD_PATH, 24)
FONT_TITLE = ImageFont.truetype(FONT_BOLD_PATH, 46)
FONT_SUBTITLE = ImageFont.truetype(FONT_REG_PATH, 27)

SCENES = [
    {
        "id": "scene1",
        "image": "sop-hero-banner.jpg",
        "tag": "01 / 行业痛点与挑战",
        "title": "告别上下文丢失与重复返工",
        "sub_line1": "不同 AI 换个窗口就忘记规约、反复返工？",
        "sub_line2": "项目的最佳实践经验，总是难以在智能体之间高效传承？",
        "voice_text": "你是否遇到过，不同 AI 换个窗口就忘记规约、反复返工？项目的最佳实践经验，总是难以在智能体之间高效传承？",
        "motion_type": "push_in" # 缓慢向前推入
    },
    {
        "id": "scene2",
        "image": "cmd-start.jpg",
        "tag": "02 / 极简开工对齐",
        "title": "一句话自动对齐历史工程规约",
        "sub_line1": "开工只需一句话，新 Agent 秒级对齐最佳实践",
        "sub_line2": "严格遵守 0-1 破局路径、避坑清单与开发铁律",
        "voice_text": "告别繁琐文档！开工只需一句话，智能体即可秒级对齐历史规约，严格遵守避坑清单与开发铁律。",
        "motion_type": "pan_down_right" # 缓慢向全息蓝图微推移
    },
    {
        "id": "scene3",
        "image": "cmd-finish.jpg",
        "tag": "03 / 完工全自动沉淀",
        "title": "一键萃取破局经验 · 秒级自愈入库",
        "sub_line1": "完工对 Agent 说一句话，自动提炼避坑铁律与 0-1 步骤",
        "sub_line2": "自动提交 PR 与云端自愈合并，全程无需手动复制",
        "voice_text": "项目完工，同样只需一句话。全自动提炼破局经验与实操步骤，云端秒级自愈合并入库，全程无需手动复制！",
        "motion_type": "push_in_crystal" # 聚焦金色代码晶体
    },
    {
        "id": "scene4",
        "image": "fde-platform.jpg",
        "tag": "04 / 产业级算力底座",
        "title": "神州鲲泰 FDE 智算与企业级 AI 赋能",
        "sub_line1": "面向企业真实场景的产业级 AI 落地支撑",
        "sub_line2": "知识规约与全栈智算算力底座双轮驱动",
        "voice_text": "更有神州鲲泰 FDE 开发者平台深度赋能，提供产业级智算与企业级落地支撑，让知识规约与算力底座双轮驱动。",
        "motion_type": "pan_right" # 展现算力中心全景横移
    },
    {
        "id": "scene5",
        "image": "sop-hero-banner.jpg",
        "tag": "05 / 人机协同新范式",
        "title": "SOP 誊录馆 · 复杂的留给智能体，你只用一句话",
        "sub_line1": "开源规约托管 · 跨 Agent 随取随用 · 永久沉淀",
        "sub_line2": "即刻访问 dcn-autotest-team.github.io/sop",
        "voice_text": "SOP 誊录馆，把复杂的留给智能体，你只用一句话。即刻访问，开启人机协同新范式！",
        "motion_type": "pull_out" # 缓慢拉开展现全景
    }
]

def generate_subtitle_overlay(scene, out_png):
    """生成高清透明字幕蒙版 (固定于前景，保证阅读稳定性)"""
    img = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. 顶部章节标牌
    tag_x, tag_y = 90, 68
    tag_bbox = draw.textbbox((tag_x, tag_y), scene["tag"], font=FONT_TAG)
    padding_x, padding_y = 16, 7
    pill_rect = [tag_bbox[0] - padding_x, tag_bbox[1] - padding_y, tag_bbox[2] + padding_x, tag_bbox[3] + padding_y]
    draw.rounded_rectangle(pill_rect, radius=6, fill=(176, 58, 46, 235), outline=(255, 255, 255, 90), width=1)
    draw.text((tag_x, tag_y), scene["tag"], font=FONT_TAG, fill=(255, 255, 255, 255))

    # 2. 底部半透明卡片
    card_x0, card_y0 = 90, 816
    card_x1, card_y1 = 1830, 1028
    draw.rounded_rectangle([card_x0, card_y0, card_x1, card_y1], radius=14, fill=(16, 13, 10, 220), outline=(226, 132, 122, 90), width=1)

    # 3. 标题与字幕
    title_text = scene["title"]
    draw.text((card_x0 + 36, card_y0 + 24), title_text, font=FONT_TITLE, fill=(248, 220, 150, 255))
    draw.text((card_x0 + 38, card_y0 + 94), scene["sub_line1"], font=FONT_SUBTITLE, fill=(245, 240, 230, 245))
    draw.text((card_x0 + 38, card_y0 + 138), scene["sub_line2"], font=FONT_SUBTITLE, fill=(208, 198, 185, 235))

    img.save(out_png, "PNG")

async def synthesize_voice(text, out_mp3):
    """调用微软云端 Neural 超自然神经网络语音（云扬·沉稳专业科技男声 + 广播级电容麦混音滤镜）"""
    import edge_tts
    raw_mp3 = out_mp3.with_suffix(".raw.mp3")
    proxies = ["http://127.0.0.1:7890", None]
    success = False
    for p in proxies:
        try:
            # 采用云扬沉稳科技发布会播音音色，语速设为 -4%，节奏舒缓沉稳，极低数码机械感
            comm = edge_tts.Communicate(text, voice="zh-CN-YunyangNeural", rate="-4%", pitch="+0Hz", proxy=p)
            await comm.save(str(raw_mp3))
            if os.path.exists(raw_mp3) and os.path.getsize(raw_mp3) > 1000:
                success = True
                break
        except Exception:
            continue
    if not success:
        raise RuntimeError(f"Edge TTS 失败: {text[:20]}")

    # 广播级专业电容麦混音后处理：切除超低频共振、强化温暖胸腔厚度、平滑高频数码感、动态电平压限
    audio_filter = (
        "highpass=f=75,lowpass=f=11000,"
        "equalizer=f=220:t=q:w=1.2:g=2.5,"
        "equalizer=f=3200:t=q:w=1.0:g=1.2,"
        "dynaudnorm=p=0.9:m=10"
    )
    subprocess.check_call(
        f'ffmpeg -y -i "{raw_mp3}" -af "{audio_filter}" -c:a libmp3lame -b:a 192k "{out_mp3}"',
        shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    if raw_mp3.exists():
        raw_mp3.unlink()

def get_duration(file_path):
    cmd = f'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "{file_path}"'
    return float(subprocess.check_output(cmd, shell=True, text=True).strip())

def render_smooth_scene(scene, base_img_path, overlay_png_path, audio_path, out_mp4, duration):
    """
    使用 Python 浮点缓动多步插值 + FFmpeg 管道，生成丝滑电影级运镜片段
    FPS = 30，采用 Cosine Easing 平滑缓动
    """
    fps = 30
    total_frames = int(round(duration * fps))
    
    # 打开源图并转为 RGB
    raw_img = Image.open(base_img_path).convert("RGBA")
    src_w, src_h = raw_img.size
    
    # 打开字幕贴图 (RGBA)
    overlay_img = Image.open(overlay_png_path).convert("RGBA")

    # 启动 FFmpeg 管道，接收原始 rgba 视频帧
    # 注意：音频使用 apad 填充末尾静音以匹配视频时长，并显式指定 -t duration，避免 -shortest 提前结束导致 BrokenPipe
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", "1920x1080",
        "-pix_fmt", "rgba",
        "-r", str(fps),
        "-i", "-", # 从标准输入读取帧
        "-i", str(audio_path),
        "-af", "apad",
        "-t", f"{duration:.3f}",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        str(out_mp4)
    ]

    err_log_path = TEMP_DIR / f"{scene['id']}_ffmpeg.log"
    err_log = open(err_log_path, "w", encoding="utf-8")

    proc = subprocess.Popen(
        ffmpeg_cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=err_log
    )

    motion = scene["motion_type"]

    for frame_idx in range(total_frames):
        # 归一化时间 t: 0.0 -> 1.0
        t = frame_idx / float(total_frames - 1) if total_frames > 1 else 0.0
        # 余弦平滑缓动函数 (Cosine Easing)
        ease = (1.0 - math.cos(t * math.pi)) / 2.0

        if motion == "push_in":
            # 缓慢推近：缩放 1.00 -> 1.09，中心保持居中
            zoom = 1.0 + 0.09 * ease
            w = src_w / zoom
            h = src_h / zoom
            x = (src_w - w) / 2.0
            y = (src_h - h) / 2.0
        elif motion == "pan_down_right":
            # 向右下微移并推近 1.00 -> 1.07
            zoom = 1.0 + 0.07 * ease
            w = src_w / zoom
            h = src_h / zoom
            x = (src_w - w) * (0.35 + 0.3 * ease)
            y = (src_h - h) * (0.35 + 0.3 * ease)
        elif motion == "push_in_crystal":
            # 聚焦小机器人与水晶，由全景推入到晶体位置
            zoom = 1.0 + 0.085 * ease
            w = src_w / zoom
            h = src_h / zoom
            x = (src_w - w) * (0.4 + 0.2 * ease)
            y = (src_h - h) * (0.45 + 0.15 * ease)
        elif motion == "pan_right":
            # 横向平稳滑移展示机房全景
            zoom = 1.05
            w = src_w / zoom
            h = src_h / zoom
            x = (src_w - w) * (0.15 + 0.7 * ease)
            y = (src_h - h) / 2.0
        elif motion == "pull_out":
            # 缓慢拉开：由局部放大 1.08 缓退至 1.00 全景
            zoom = 1.08 - 0.08 * ease
            w = src_w / zoom
            h = src_h / zoom
            x = (src_w - w) / 2.0
            y = (src_h - h) / 2.0
        else:
            zoom = 1.0 + 0.06 * ease
            w = src_w / zoom
            h = src_h / zoom
            x = (src_w - w) / 2.0
            y = (src_h - h) / 2.0

        crop_box = (int(round(x)), int(round(y)), int(round(x + w)), int(round(y + h)))
        # 双三次平滑插值裁剪缩放为 1920x1080
        cropped = raw_img.crop(crop_box).resize((1920, 1080), Image.Resampling.BICUBIC)
        # 叠加上层固定字幕
        frame_composed = Image.alpha_composite(cropped, overlay_img)

        try:
            proc.stdin.write(frame_composed.tobytes())
        except (BrokenPipeError, OSError):
            break

        if (frame_idx + 1) % 45 == 0 or frame_idx + 1 == total_frames:
            print(f"\r      渲染进度: {frame_idx + 1}/{total_frames} 帧 ({(frame_idx + 1)/total_frames*100:.0f}%)", end="", flush=True)

    print()
    try:
        proc.stdin.close()
    except Exception:
        pass
    proc.wait()
    err_log.close()
    if proc.returncode != 0:
        err_msg = err_log_path.read_text(encoding="utf-8", errors="ignore")
        raise RuntimeError(f"FFmpeg 渲染片段失败 (code {proc.returncode}):\n{err_msg}")

async def main():
    print("==================================================================")
    print("🎬 SOP 誊录馆 · 电影级极简产品宣传片渲染中 (超丝滑运镜 + 科技 BGM)")
    print("==================================================================")

    bgm_path = ASSETS_DIR / "bgm-technology.mp3"
    if not bgm_path.exists():
        raise FileNotFoundError("未检测到背景音乐文件 bgm-technology.mp3")

    scene_clips = []
    total_video_duration = 0.0

    for idx, sc in enumerate(SCENES):
        print(f"\n>>> 正在处理第 [{idx + 1}/{len(SCENES)}] 幕: {sc['title']}")

        # 1. 语音合成
        audio_mp3 = TEMP_DIR / f"{sc['id']}.mp3"
        print(f"    [1/3 语音] 微软云端 Neural 神经网络配音...")
        await synthesize_voice(sc["voice_text"], audio_mp3)
        dur = get_duration(audio_mp3)
        scene_dur = round(dur + 0.8, 2)
        total_video_duration += scene_dur
        print(f"    [Audio] 时长: {dur:.2f}s | 视频幕长: {scene_dur:.2f}s")

        # 2. 字幕图层
        overlay_png = TEMP_DIR / f"{sc['id']}_sub.png"
        generate_subtitle_overlay(sc, overlay_png)

        # 3. 丝滑运镜渲染
        img_path = ASSETS_DIR / sc["image"]
        clip_mp4 = TEMP_DIR / f"{sc['id']}_clip.mp4"
        print(f"    [2/3 运镜] 正在以 30fps 浮点缓动计算电影级丝滑运镜 ({sc['motion_type']})...")
        render_smooth_scene(sc, img_path, overlay_png, audio_mp3, clip_mp4, scene_dur)
        print(f"    [3/3 完成] 分幕片段已生成: {clip_mp4.name}")
        scene_clips.append(clip_mp4)

    print("\n>>> [4/4 视听合流] 正在拼接视频并混入高质量科技背景音乐 (BGM)...")
    concat_txt = TEMP_DIR / "concat.txt"
    with open(concat_txt, "w", encoding="utf-8") as f:
        for clip in scene_clips:
            clean_p = str(clip).replace("\\", "/")
            f.write(f"file '{clean_p}'\n")

    # 纯画面+旁白拼接临时文件
    temp_concat_mp4 = TEMP_DIR / "temp_concat.mp4"
    subprocess.check_call(
        f'ffmpeg -y -f concat -safe 0 -i "{concat_txt}" -c copy "{temp_concat_mp4}"',
        shell=True, stdout=subprocess.DEVNULL
    )

    final_total_dur = get_duration(temp_concat_mp4)
    print(f"    视频总时长: {final_total_dur:.2f}s")

    # 最终视听合流：人声轨 (0dB) + BGM (-17dB 柔和衬底，开头 1.2s 淡入，结尾 2.8s 优雅淡出)
    final_assets_mp4 = ASSETS_DIR / "sop-product-intro.mp4"
    final_public_mp4 = PUBLIC_DIR / "sop-product-intro.mp4"

    bgm_fade_out_start = max(0, final_total_dur - 2.8)
    mix_filter = (
        f"[1:a]volume=0.14,afade=t=in:ss=0:d=1.2,afade=t=out:st={bgm_fade_out_start:.2f}:d=2.8[bgm];"
        f"[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]"
    )

    merge_cmd = (
        f'ffmpeg -y -i "{temp_concat_mp4}" -i "{bgm_path}" '
        f'-filter_complex "{mix_filter}" -map 0:v -map "[aout]" '
        f'-c:v libx264 -preset medium -crf 21 -movflags +faststart '
        f'-c:a aac -b:a 192k "{final_assets_mp4}"'
    )
    subprocess.check_call(merge_cmd, shell=True, stdout=subprocess.DEVNULL)

    import shutil
    shutil.copy(final_assets_mp4, final_public_mp4)

    file_size_mb = os.path.getsize(final_assets_mp4) / (1024 * 1024)
    print("\n==================================================================")
    print(f"🎉 [Success] 极度丝滑运镜 + 商业级科技 BGM + 微软自然语音产品介绍视频大成！")
    print(f"📁 归档路径: {final_assets_mp4} ({file_size_mb:.2f} MB)")
    print(f"🌐 网页分发: {final_public_mp4}")
    print("==================================================================")

if __name__ == "__main__":
    asyncio.run(main())
