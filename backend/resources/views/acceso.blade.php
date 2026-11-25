<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport"
          content="width=device-width, initial-scale=1">

    <title>Acceso - Corporación Ortega</title>

    <style>
        body {
            font-family: Arial, sans-serif;
            background: #f2f4f7;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }

        .login {
            background: white;
            padding: 32px;
            border-radius: 12px;
            width: 340px;
            box-shadow: 0 4px 20px #00000015;
        }

        h2 {
            text-align: center;
            margin-top: 0;
        }

        label {
            display: block;
            margin: 16px 0 6px;
        }

        input, button {
            width: 100%;
            padding: 12px;
            box-sizing: border-box;
        }

        button {
            background: #174b74;
            color: white;
            border: none;
            border-radius: 6px;
            margin-top: 22px;
            cursor: pointer;
        }
    </style>
</head>

<body>
    <div class="login">
        <h2>Corporación Ortega</h2>
        <p>Prueba de inicio de sesión</p>

        <form method="POST" action="/api/auth/login">
            @csrf

            <label for="correo">
                Correo electrónico
            </label>

            <input
                id="correo"
                type="email"
                name="correo"
                required
                autocomplete="username"
            >

            <label for="password">
                Contraseña
            </label>

            <input
                id="password"
                type="password"
                name="password"
                required
                autocomplete="current-password"
            >

            <button type="submit">
                Iniciar sesión
            </button>
        </form>

<form method="POST" action="/api/auth/logout">
    @csrf

    <button type="submit">
        Cerrar sesión
    </button>
</form>

    </div>
</body>
</html>
