import { useEffect, useRef } from "react"

interface MeshProps {
  className?: string
  isGenerating?: boolean
}

export default function GenerativeMeshVisualizer({
  className = "",
  isGenerating = false,
}: MeshProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId: number
    let time = 0
    let width = 320
    let height = 200

    const updateCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5) // Bound DPR for performance on 3x screens
      const rect = container.getBoundingClientRect()
      width = Math.max(rect.width, 240)
      height = Math.max(rect.height, 160)

      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform
      ctx.scale(dpr, dpr)
    }

    updateCanvasSize()

    // Listen for container resize (device rotation, responsive grid changes)
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize()
    })
    resizeObserver.observe(container)

    window.addEventListener("resize", updateCanvasSize)

    // Parametric Torus / Mobius Ribbon Mesh Points
    const uSegments = 38
    const vSegments = 22

    const render = () => {
      time += isGenerating ? 0.04 : 0.015
      ctx.clearRect(0, 0, width, height)

      const cx = width / 2
      const cy = height / 2
      // Proportional scale responsive to viewport
      const scale = Math.min(width, height) * 0.38

      // Projected points cache
      const grid: Array<Array<{
        x: number
        y: number
        z: number
        color: string
      }>> = []

      for (let i = 0; i <= uSegments; i++) {
        const row: Array<{ x: number; y: number; z: number; color: string }> = []
        const u = (i / uSegments) * Math.PI * 2

        for (let j = 0; j <= vSegments; j++) {
          const v = (j / vSegments) * Math.PI * 2

          // Organic Parametric Surface (Torus Knot + undulating harmonic ripples)
          const r1 = 1.1 + 0.15 * Math.sin(3 * u + time)
          const r2 = 0.45 + 0.1 * Math.cos(2 * v - time * 0.8)

          const px0 = (r1 + r2 * Math.cos(v)) * Math.cos(u)
          const py0 = (r1 + r2 * Math.cos(v)) * Math.sin(u)
          const pz0 = r2 * Math.sin(v) + 0.25 * Math.sin(2 * u + time)

          // 3D Rotations
          const rotX = 0.45 + Math.sin(time * 0.4) * 0.12
          const rotY = time * 0.35

          // Rotate Y
          const x1 = px0 * Math.cos(rotY) + pz0 * Math.sin(rotY)
          const y1 = py0
          const z1 = -px0 * Math.sin(rotY) + pz0 * Math.cos(rotY)

          // Rotate X
          const x2 = x1
          const y2 = y1 * Math.cos(rotX) - z1 * Math.sin(rotX)
          const z2 = y1 * Math.sin(rotX) + z1 * Math.cos(rotX)

          // Perspective Projection
          const fov = 3.2
          const depth = fov / (fov + z2)
          const projX = cx + x2 * scale * depth
          const projY = cy + y2 * scale * depth

          // Vibrant organic gradient (Coral, Amber, Rose, Violet, Jade)
          const normZ = (z2 + 1.2) / 2.4
          const hue = (15 + normZ * 320 + Math.sin(u) * 40) % 360
          const lightness = 48 + normZ * 22
          const alpha = 0.35 + normZ * 0.55

          row.push({
            x: projX,
            y: projY,
            z: z2,
            color: `hsla(${hue}, 88%, ${lightness}%, ${alpha})`,
          })
        }
        grid.push(row)
      }

      // Draw wireframe connecting lines
      for (let i = 0; i < uSegments; i++) {
        for (let j = 0; j < vSegments; j++) {
          const p00 = grid[i][j]
          const p01 = grid[i][j + 1]
          const p10 = grid[i + 1][j]

          // Draw U-line
          ctx.beginPath()
          ctx.moveTo(p00.x, p00.y)
          ctx.lineTo(p10.x, p10.y)
          ctx.strokeStyle = p00.color
          ctx.lineWidth = 0.9
          ctx.stroke()

          // Draw V-line
          ctx.beginPath()
          ctx.moveTo(p00.x, p00.y)
          ctx.lineTo(p01.x, p01.y)
          ctx.strokeStyle = p00.color
          ctx.lineWidth = 0.7
          ctx.stroke()

          // Draw high-density point particle
          if (i % 2 === 0 && j % 2 === 0) {
            ctx.fillStyle = p00.color
            ctx.beginPath()
            ctx.arc(p00.x, p00.y, 1.2, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateCanvasSize)
    }
  }, [isGenerating])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-42.5 sm:h-48.75 md:h-52.5 flex items-center justify-center overflow-hidden select-none pointer-events-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  )
}
