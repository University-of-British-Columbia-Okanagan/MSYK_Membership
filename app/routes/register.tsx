
import { PrismaClient } from '@prisma/client';
import React, { useState } from 'react';
import { Form, type ActionFunctionArgs, redirect, useFetcher } from 'react-router';
const prisma = new PrismaClient();

export async function loader() {
    const users = await prisma.user.findMany();
    return users;
}

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;

    await prisma.user.create({
        data: {
            email,
            password,
            firstName,
            lastName,
        },
    });

    return redirect('/register');
}

export default function Register() {
    const [formValues, setFormValues] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormValues({
            ...formValues,
            [name]: value,
        });
    };

    const handleReset = () => {
        setFormValues({
            email: '',
            password: '',
            firstName: '',
            lastName: '',
        });
    };

    return (
      <>
        <div>Welcome to register</div>
            <Form method="post" onSubmit={() => handleReset()}>
                <div>
                    <label>
                        Email:
                        <input type="email" name="email" value={formValues.email} onChange={handleChange}/>
                    </label>
                </div>
                <div>
                    <label>
                        Password:
                        <input type="password" name="password" value={formValues.password} onChange={handleChange}/>
                    </label>
                </div>
                <div>
                    <label>
                        First Name:
                        <input type="text" name="firstName" value={formValues.firstName} onChange={handleChange}/>
                    </label>
                </div>
                <div>
                    <label>
                        Last Name:
                        <input type="text" name="lastName" value={formValues.lastName} onChange={handleChange}/>
                    </label>
                </div>
                <button type="submit">Add User</button>
            </Form>
      </>
    );
}