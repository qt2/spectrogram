"use client";

import { useEffect, useRef, useState } from "react";
import { IoMic } from "react-icons/io5";
import colormap from "colormap";
import { useHotkeys } from "react-hotkeys-hook";
import Head from "next/head";

export default function Page() {
  return (
    <>
      <Head>
        <title>Spectrogram</title>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta name="description" content="Spectrogram" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Spectrogram />
    </>
  );
}

function Spectrogram() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  let recording = true;

  async function updateSpectrogram() {
    // Initialize canvas
    if (!canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const render = canvas.getContext("2d", { willReadFrequently: true })!;

    const w = canvas.width;
    const h = canvas.height;
    const offsetH = 120;
    const offsetV = 80;

    // Background
    render.fillStyle = "black";
    render.fillRect(0, 0, w, h);

    // Axis
    render.strokeStyle = "white";
    render.lineWidth = 2;
    render.beginPath();
    render.moveTo(offsetH, h - offsetV);
    render.lineTo(w - offsetH, h - offsetV);
    render.moveTo(offsetH, h - offsetV);
    render.lineTo(offsetH, offsetV);
    render.stroke();

    const colors = colormap({ colormap: "jet", nshades: 256 });

    // Retrieve mic stream
    let stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!stream) {
      console.log("not found");
      return;
    }

    // Form audio routing graph
    const audio = new AudioContext();
    const source = audio.createMediaStreamSource(stream);
    const analyzer = audio.createAnalyser();
    analyzer.fftSize = 2048;
    analyzer.smoothingTimeConstant = 0;
    source.connect(analyzer);
    const bandWidth = audio.sampleRate / analyzer.fftSize;
    const frequencies = new Uint8Array(analyzer.frequencyBinCount);

    // Draw frequency labels
    for (let i = 0; i < h - 2 * offsetV; i++) {
      if ((i * bandWidth) % 1000 < bandWidth) {
        const text = `${Math.floor((i * bandWidth) / 1000) * 1000}Hz`;
        render.fillStyle = "white";
        render.textAlign = "end";
        render.textBaseline = "middle";
        render.fillText(text, offsetH - 8, h - offsetV - i);
      }
    }

    // Draw spectrogram
    function draw() {
      requestAnimationFrame(draw);

      if (recording) {
        const canvasImage = render.getImageData(0, 0, w, h);
        const previousRegion = render.getImageData(
          offsetH + 2,
          offsetV,
          w - 2 * offsetH,
          h - offsetV * 2 - 2
        );

        render.putImageData(canvasImage, 0, 0);
        render.putImageData(previousRegion, offsetH + 1, offsetV);

        analyzer.getByteFrequencyData(frequencies);

        for (let i = 0; i < h - 2 * offsetV; i++) {
          const isGridLine = (i * bandWidth) % 1000 < bandWidth;
          render.fillStyle = isGridLine
            ? "white"
            : (colors[frequencies[i]] as string);
          render.fillRect(w - offsetH, h - offsetV - i, 1, 1);
        }
      }
    }
    draw();

    return audio;
  }

  useEffect(() => {
    const audio = updateSpectrogram();

    // Close audio context when destructed
    return () => {
      audio.then((a) => {
        a?.close();
      });
    };
  }, []);

  function toggleRecording() {
    recording = !recording;
  }

  useHotkeys("r", toggleRecording);

  return (
    <main className="min-h-screen flex flex-col justify-center items-center">
      <canvas ref={canvasRef} width={720} height={480}></canvas>
      <div className="p-2 flex gap-2">
        <button
          className="btn btn-primary btn-square tooltip flex justify-center items-center"
          data-tip="Start/Stop recording [R]"
          onClick={toggleRecording}
        >
          <IoMic className="text-xl" />
        </button>
      </div>
    </main>
  );
}
