// frontend/middleware.js
// Route protection is handled client-side via the (protected) layout.
// This middleware is a simple pass-through.
import { NextResponse } from 'next/server'

export function middleware(request) {
  return NextResponse.next()
}
