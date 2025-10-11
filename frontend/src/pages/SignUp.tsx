import React from 'react';

const SignUp: React.FC = () => {
    return (
        <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
            <h2>Sign Up</h2>
            <form>
                <div style={{ marginBottom: 16 }}>
                    <label htmlFor="email">Email:</label>
                    <input type="email" id="email" name="email" style={{ width: '100%', padding: 8, marginTop: 4 }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                    <label htmlFor="password">Password:</label>
                    <input type="password" id="password" name="password" style={{ width: '100%', padding: 8, marginTop: 4 }} />
                </div>
                <button type="submit" style={{ width: '100%', padding: 10 }}>Sign Up</button>
            </form>
        </div>
    );
};

export default SignUp;