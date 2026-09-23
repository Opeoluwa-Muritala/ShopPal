'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';

export interface EditableFieldProps {
  id: string;
  label: string;
  value: string;
  onSave: (newValue: string) => Promise<boolean | void> | boolean | void;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel';
  isTextArea?: boolean;
  maxLength?: number;
  autoFormat?: (val: string) => string;
  validate?: (val: string) => string | null;
  hint?: string;
  saveOnBlur?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function EditableField({
  id,
  label,
  value,
  onSave,
  placeholder,
  type = 'text',
  isTextArea = false,
  maxLength,
  autoFormat,
  validate,
  hint,
  saveOnBlur = false,
  disabled = false,
  className = '',
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    let newVal = e.target.value;
    if (autoFormat) {
      newVal = autoFormat(newVal);
    }
    setDraftValue(newVal);
    if (error && validate) {
      const err = validate(newVal);
      setError(err);
    }
  };

  const handleStartEdit = () => {
    if (disabled) return;
    setDraftValue(value);
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraftValue(value);
    setError(null);
    setIsEditing(false);
  };

  const handleCommit = async () => {
    if (validate) {
      const validationError = validate(draftValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    setError(null);

    if (draftValue === value) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      const res = await onSave(draftValue);
      if (res !== false) {
        setIsEditing(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && !isTextArea) {
      e.preventDefault();
      handleCommit();
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (!saveOnBlur) return;
    // Don't blur-save if clicking the cancel or action buttons within this container
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    handleCommit();
  };

  return (
    <div
      className={`border border-slate-200/90 rounded-xl p-4 bg-white hover:border-slate-300 transition-colors ${className}`}
      onBlur={handleBlur}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label
          htmlFor={id}
          className="text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          {label}
        </label>
        {!isEditing && !disabled && (
          <button
            type="button"
            onClick={handleStartEdit}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition"
            aria-label={`Edit ${label}`}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2 mt-2">
          {isTextArea ? (
            <textarea
              id={id}
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draftValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              maxLength={maxLength}
              rows={3}
              placeholder={placeholder}
              disabled={isSaving}
              className={`w-full text-sm text-slate-900 border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition resize-none ${
                error ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
              }`}
            />
          ) : (
            <input
              id={id}
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type}
              value={draftValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              maxLength={maxLength}
              placeholder={placeholder}
              disabled={isSaving}
              className={`w-full text-sm text-slate-900 border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition ${
                error ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
              }`}
            />
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex-1">
              {error ? (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {error}
                </p>
              ) : hint ? (
                <p className="text-xs text-slate-500">{hint}</p>
              ) : null}
            </div>

            {maxLength && (
              <span className="text-[11px] text-slate-400 font-mono">
                {draftValue.length}/{maxLength}
              </span>
            )}

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleCommit}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between min-h-[32px]">
          <span
            className={`text-sm font-medium ${
              value ? 'text-slate-900' : 'text-slate-400 italic'
            }`}
          >
            {value || placeholder || 'Not set'}
          </span>
          {hint && !isEditing && (
            <span className="text-xs text-slate-400 hidden sm:inline">
              {hint}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
