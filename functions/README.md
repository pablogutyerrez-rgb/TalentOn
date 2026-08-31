# Código local heredado

Este directorio se conserva únicamente para el script local de bootstrap y como referencia histórica. No forma parte del despliegue de Railway ni se encuentra registrado como fuente de Functions en `firebase.json`.

Las operaciones de producción se ejecutan en `worker/`. No despliegue este directorio con `firebase deploy --only functions`.
