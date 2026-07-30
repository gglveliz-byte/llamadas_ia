#!/bin/bash
# Inicia el backend Express del VozIA en background.
# Usa nohup + setsid para mantenerse vivo después del shell.

BACKEND_DIR="/home/z/my-project/mini-services/backend-express"
LOG_FILE="/tmp/backend-express.log"
PID_FILE="/tmp/backend-express.pid"

# Matar proceso previo si existe
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Matando proceso previo (PID $OLD_PID)..."
        kill -9 "$OLD_PID" 2>/dev/null
    fi
    rm -f "$PID_FILE"
fi

# También matar por nombre
pkill -f "bun.*backend-express/src/index.ts" 2>/dev/null
sleep 1

cd "$BACKEND_DIR"

# Iniciar con setsid para desvincular del shell
setsid nohup bun src/index.ts > "$LOG_FILE" 2>&1 < /dev/null &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"
disown

echo "Backend iniciado con PID $NEW_PID"
echo "Log: $LOG_FILE"

# Esperar a que esté listo
for i in {1..10}; do
    sleep 1
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ Backend respondiendo en http://localhost:3001"
        exit 0
    fi
done

echo "⚠️  Backend no respondió después de 10s. Ver log:"
tail -20 "$LOG_FILE"
exit 1
