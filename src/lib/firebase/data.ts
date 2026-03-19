import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './client';

export type AppRole = 'admin' | 'beneficiary';
export type TransactionType = 'deposit' | 'withdrawal' | 'earning';
export type TransactionStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: AppRole;
  phone?: string;
  cedula?: string;
  bankName?: string;
  accountNumber?: string;
  status?: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  reference: string;
  proofUrl?: string;
  proofPath?: string;
  bankName?: string;
  accountNumber?: string;
  cedula?: string;
  phone?: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

function mapUserProfile(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    uid,
    email: String(data.email ?? ''),
    name: String(data.name ?? 'Sin nombre'),
    role: data.role === 'admin' ? 'admin' : 'beneficiary',
    phone: typeof data.phone === 'string' ? data.phone : '',
    cedula: typeof data.cedula === 'string' ? data.cedula : '',
    bankName: typeof data.bankName === 'string' ? data.bankName : '',
    accountNumber: typeof data.accountNumber === 'string' ? data.accountNumber : '',
    status: typeof data.status === 'string' ? data.status : 'active',
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function mapTransaction(id: string, data: Record<string, unknown>): TransactionRecord {
  return {
    id,
    userId: String(data.userId ?? ''),
    userName: String(data.userName ?? 'Sin nombre'),
    userEmail: String(data.userEmail ?? ''),
    type: data.type === 'withdrawal' || data.type === 'earning' ? data.type : 'deposit',
    status: data.status === 'approved' || data.status === 'paid' || data.status === 'rejected' ? data.status : 'pending',
    amount: Number(data.amount ?? 0),
    reference: String(data.reference ?? ''),
    proofUrl: typeof data.proofUrl === 'string' ? data.proofUrl : '',
    proofPath: typeof data.proofPath === 'string' ? data.proofPath : '',
    bankName: typeof data.bankName === 'string' ? data.bankName : '',
    accountNumber: typeof data.accountNumber === 'string' ? data.accountNumber : '',
    cedula: typeof data.cedula === 'string' ? data.cedula : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function ensureUserProfile(user: User, defaults?: Partial<UserProfile>) {
  const refDoc = doc(db, 'users', user.uid);
  const snapshot = await getDoc(refDoc);

  if (!snapshot.exists()) {
    await setDoc(refDoc, {
      uid: user.uid,
      email: defaults?.email ?? user.email ?? '',
      name: defaults?.name ?? user.displayName ?? user.email?.split('@')[0] ?? 'Nuevo beneficiario',
      role: 'beneficiary',
      status: 'active',
      phone: defaults?.phone ?? '',
      cedula: defaults?.cedula ?? '',
      bankName: defaults?.bankName ?? '',
      accountNumber: defaults?.accountNumber ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const current = await getDoc(refDoc);
  return mapUserProfile(user.uid, current.data() ?? {});
}

export async function getUserProfile(uid: string) {
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return null;
  return mapUserProfile(snapshot.id, snapshot.data() as Record<string, unknown>);
}

export async function updateUserProfile(uid: string, payload: Partial<UserProfile>) {
  await updateDoc(doc(db, 'users', uid), {
    name: payload.name ?? '',
    email: payload.email ?? '',
    phone: payload.phone ?? '',
    cedula: payload.cedula ?? '',
    bankName: payload.bankName ?? '',
    accountNumber: payload.accountNumber ?? '',
    updatedAt: serverTimestamp(),
  });
}

export function watchUserTransactions(uid: string, callback: (items: TransactionRecord[]) => void) {
  const transactionsQuery = query(collection(db, 'transactions'), where('userId', '==', uid));

  return onSnapshot(transactionsQuery, (snapshot) => {
    const items = snapshot.docs
      .map((item) => mapTransaction(item.id, item.data() as Record<string, unknown>))
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    callback(items);
  });
}

export function watchAllTransactions(callback: (items: TransactionRecord[]) => void) {
  return onSnapshot(collection(db, 'transactions'), (snapshot) => {
    const items = snapshot.docs
      .map((item) => mapTransaction(item.id, item.data() as Record<string, unknown>))
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    callback(items);
  });
}

export function watchBeneficiaries(callback: (items: UserProfile[]) => void) {
  const usersQuery = query(collection(db, 'users'), where('role', '==', 'beneficiary'));

  return onSnapshot(usersQuery, (snapshot) => {
    const items = snapshot.docs
      .map((item) => mapUserProfile(item.id, item.data() as Record<string, unknown>))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    callback(items);
  });
}

export async function createDepositTransaction(input: {
  profile: UserProfile;
  amount: number;
  reference: string;
  file: File;
}) {
  const safeName = input.file.name.replace(/\s+/g, '-');
  const proofPath = `deposit-proofs/${input.profile.uid}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, proofPath);
  await uploadBytes(storageRef, input.file);
  const proofUrl = await getDownloadURL(storageRef);

  await addDoc(collection(db, 'transactions'), {
    userId: input.profile.uid,
    userName: input.profile.name,
    userEmail: input.profile.email,
    type: 'deposit',
    status: 'pending',
    amount: input.amount,
    reference: input.reference,
    proofUrl,
    proofPath,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createWithdrawalTransaction(input: {
  profile: UserProfile;
  amount: number;
  bankName: string;
  accountNumber: string;
  cedula: string;
  phone: string;
  reference: string;
}) {
  await addDoc(collection(db, 'transactions'), {
    userId: input.profile.uid,
    userName: input.profile.name,
    userEmail: input.profile.email,
    type: 'withdrawal',
    status: 'pending',
    amount: input.amount,
    reference: input.reference,
    bankName: input.bankName,
    accountNumber: input.accountNumber,
    cedula: input.cedula,
    phone: input.phone,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTransactionStatus(id: string, status: TransactionStatus) {
  await updateDoc(doc(db, 'transactions', id), {
    status,
    updatedAt: serverTimestamp(),
  });
}
