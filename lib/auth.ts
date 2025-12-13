import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authenticateUser } from "./auth/service";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter an email and password");
        }

        const result = await authenticateUser(credentials.email, credentials.password);

        if (!result.success || !result.user) {
          throw new Error(result.error || "Invalid email or password");
        }

        return {
          id: result.user.id,
          email: result.user.email,
          image: result.user.image,
        };
      },
    }),
  ],
  
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/auth",
    error: "/auth",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};
