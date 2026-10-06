module.exports = {
  apps: [
    {
      name: "safeprint",
      cwd: "/root/safeprint/web",
      script: "npm",
      args: "run start -- -p 3005",
      env: {
        NODE_ENV: "production",
        PORT: "3005",
      },
      watch: false,
      max_memory_restart: "600M",
      restart_delay: 3000,
      max_restarts: 20,
      min_uptime: "10s",
      error_file: "/root/.pm2/logs/safeprint-error.log",
      out_file: "/root/.pm2/logs/safeprint-out.log",
      time: true,
    },
  ],
};
