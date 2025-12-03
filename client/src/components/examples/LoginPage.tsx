import LoginPage from '../LoginPage';

export default function LoginPageExample() {
  return (
    <LoginPage
      onLogin={(username, password) => console.log('Login:', username, password)}
      onRegister={(username, password) => console.log('Register:', username, password)}
    />
  );
}
