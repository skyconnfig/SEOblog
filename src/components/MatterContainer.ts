export function initMatterPhysics(containerId: string, canvasId: string) {
  import("matter-js").then((Matter) => {
    const container = document.getElementById(containerId);
    const canvasEl = document.getElementById(canvasId);
    if (!container || !canvasEl) return;

    const { Engine, Render, Runner, Bodies, World, Body, Mouse, MouseConstraint } = Matter;

    const engine = Engine.create({
      gravity: { x: 0, y: 0.5 },
    });

    const render = Render.create({
      element: canvasEl,
      engine,
      options: {
        width: container.offsetWidth,
        height: 400,
        background: "transparent",
        wireframes: false,
        pixelRatio: window.devicePixelRatio || 1,
      },
    });

    const walls = [
      Bodies.rectangle(container.offsetWidth / 2, 410, container.offsetWidth + 100, 60, {
        isStatic: true,
        render: { fillStyle: "transparent" },
      }),
      Bodies.rectangle(-30, 200, 60, 600, {
        isStatic: true,
        render: { fillStyle: "transparent" },
      }),
      Bodies.rectangle(container.offsetWidth + 30, 200, 60, 600, {
        isStatic: true,
        render: { fillStyle: "transparent" },
      }),
    ];
    World.add(engine.world, walls);

    const labels = [
      { text: "AI", color: "#6366f1" },
      { text: "PLG", color: "#10b981" },
      { text: "React", color: "#06b6d4" },
      { text: "Next.js", color: "#000000" },
      { text: "Astro", color: "#f97316" },
      { text: "GPT", color: "#8b5cf6" },
      { text: "Dev", color: "#ec4899" },
    ];

    const objects: Matter.Body[] = [];

    labels.forEach((label, i) => {
      const isDark = document.documentElement.classList.contains("dark");
      const textColor = label.color;
      const size = 60 + Math.random() * 40;
      const x = 100 + Math.random() * (container.offsetWidth - 200);
      const y = -100 - i * 80;

      const canvas = document.createElement("canvas");
      canvas.width = size + 20;
      canvas.height = size + 20;
      const ctx = canvas.getContext("2d")!;

      ctx.fillStyle = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
      ctx.lineWidth = 1;

      const r = 12,
        w = size + 20,
        h = size + 20;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(w - r, 0);
      ctx.quadraticCurveTo(w, 0, w, r);
      ctx.lineTo(w, h - r);
      ctx.quadraticCurveTo(w, h, w - r, h);
      ctx.lineTo(r, h);
      ctx.quadraticCurveTo(0, h, 0, h - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = `bold ${size * 0.35}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label.text, (size + 20) / 2, (size + 20) / 2);

      const texture = canvas.toDataURL();

      const obj = Bodies.rectangle(x, y, size + 20, size + 20, {
        restitution: 0.5,
        friction: 0.05,
        density: 0.002,
        render: { sprite: { texture, xScale: 1, yScale: 1 } },
      });

      objects.push(obj);
    });

    World.add(engine.world, objects);

    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, render: { visible: false } },
    });
    World.add(engine.world, mouseConstraint);

    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    function handleResize() {
      render.canvas.width = container.offsetWidth;
      render.bounds.max.x = container.offsetWidth;
      Body.setPosition(walls[0], { x: container.offsetWidth / 2, y: 410 });
      Body.setPosition(walls[2], { x: container.offsetWidth + 30, y: 200 });
    }

    window.addEventListener("resize", handleResize);

    const pushInterval = setInterval(() => {
      objects.forEach((obj) => {
        if (Math.abs(obj.velocity.x) < 0.1 && Math.abs(obj.velocity.y) < 0.1) {
          Body.applyForce(obj, obj.position, {
            x: (Math.random() - 0.5) * 0.005,
            y: -0.005,
          });
        }
      });
    }, 3000);
  });
}
