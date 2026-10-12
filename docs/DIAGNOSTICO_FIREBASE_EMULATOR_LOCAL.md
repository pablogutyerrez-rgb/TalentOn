# Diagnóstico: Firebase Firestore Emulator local

Fecha: 2026-10-01

## Resultado

Las pruebas locales de Firestore Rules no llegan a ejecutarse. El emulador de
Firestore finaliza durante su inicialización Java/NIO, antes de abrir el puerto
8080 o de cargar/evaluar `firestore.rules`.

## Evidencia local

- Windows 11 con Eclipse Temurin OpenJDK 21.0.12.1 (64-bit). Firebase CLI 15
  requiere JDK 21 o superior.
- `JAVA_HOME` y `java.exe` apuntan al mismo JDK.
- Firebase CLI 15.28.2.
- `firebase.json` configura Auth `9099`, Firestore `8080` y UI `4000`.
- No había listeners ocupando esos puertos; una conexión TCP de proceso a
  proceso sobre `127.0.0.1` fue satisfactoria.
- El arranque aislado con `firebase emulators:start --only firestore` falló
  igualmente.

El log `firestore-debug.log` concluye con:

```text
java.lang.IllegalStateException: failed to create a child event loop
Caused by: java.io.IOException: Unable to establish loopback connection
Caused by: java.net.SocketException: Invalid argument: connect
  at sun.nio.ch.UnixDomainSockets.connect0
```

## Conclusión

Es un problema de la capa Windows/Java NIO utilizada por el emulador, no de las
Firestore Rules ni de la aplicación Talent-On. El firewall de Windows está
habilitado y Windows Defender está activo, por lo que una política de seguridad
del equipo sigue siendo una posible causa externa, aunque la prueba TCP básica
de loopback sea correcta.

## Decisión de pruebas

No cambiar `firestore.rules` ni `firebase.json` como respuesta a este fallo.
Ejecutar las pruebas de Rules en CI, donde el emulador tenga un runtime Java y
red de loopback aislados, hasta que el entorno Windows sea reparado o se pruebe
con un JDK compatible alternativo.

Validación equivalente a CI: completada en Linux con Node 22, OpenJDK 21 y
Firebase CLI 15.28.2; `npm run test:emulators` finalizó correctamente con
28/28 pruebas de Rules aprobadas.

`firebase-tools` permite configurar un `host` por emulador; se puede probar
posteriormente `"host": "127.0.0.1"` para Firestore/Auth en una rama local
dedicada. Esto no se aplicó aquí, porque el fallo ocurre dentro del selector
Java antes del bind del puerto.
