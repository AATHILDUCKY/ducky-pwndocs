
import React from 'react';
import { BookOpen, Link2, Image as ImageIcon, Video, ZoomIn, ZoomOut, RotateCcw, ClipboardCheck, Clock3, ShieldCheck, Trash2 } from 'lucide-react';
import { Issue, ReportComment, ReportCommentAttachment } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SeverityBadge } from '../ui/Elements';
import { getIsoEvidenceScore, getIssueDueDate, getProcedureGaps, getSlaStatus, ISO_CONTROL_REFERENCE } from '../../utils/vulnerabilityProcedure';

const formatTime = (timestamp: string) => {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return 'now';
  return parsed.toLocaleString();
};

const emptyText = 'Not added yet';

const AttachmentChip: React.FC<{ attachment: ReportCommentAttachment; onRemove?: () => void }> = ({ attachment, onRemove }) => {
  const Icon = attachment.type === 'image' ? ImageIcon : attachment.type === 'video' ? Video : Link2;
  const text = attachment.type === 'image'
    ? attachment.label || 'Image attached'
    : attachment.type === 'video'
      ? attachment.label || 'Video attached'
      : attachment.label || 'Link attached';

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
      <Icon size={12} className="text-slate-400" />
      <span className="max-w-[220px] truncate">{text}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-400 hover:text-rose-500"
          title="Remove attachment"
        >
          ×
        </button>
      )}
    </div>
  );
};

const LinkAttachModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onAttach: (url: string, label?: string) => void;
}> = ({ open, onClose, onAttach }) => {
  const [url, setUrl] = React.useState('');
  const [label, setLabel] = React.useState('');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4">
        <div>
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-[0.18em]">Attach Link</h4>
          <p className="text-xs text-slate-500 mt-1">Add a proof URL for this conversation.</p>
        </div>
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/proof"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10"
        />
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Optional label"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10"
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const clean = url.trim();
              if (!clean) return;
              onAttach(clean, label.trim() || undefined);
              setUrl('');
              setLabel('');
              onClose();
            }}
            className="rounded-xl bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white hover:bg-indigo-500"
          >
            Attach
          </button>
        </div>
      </div>
    </div>
  );
};

const ImageViewerModal: React.FC<{
  src: string | null;
  onClose: () => void;
}> = ({ src, onClose }) => {
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    setScale(1);
  }, [src]);

  if (!src) return null;

  return (
    <div className="fixed inset-0 z-[520] bg-slate-950/90 backdrop-blur-sm">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button onClick={() => setScale((prev) => Math.max(0.5, prev - 0.2))} className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"><ZoomOut size={16} /></button>
        <button onClick={() => setScale((prev) => Math.min(3, prev + 0.2))} className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"><ZoomIn size={16} /></button>
        <button onClick={() => setScale(1)} className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"><RotateCcw size={16} /></button>
        <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white hover:bg-white/20">Close</button>
      </div>
      <div className="h-full w-full overflow-auto flex items-center justify-center p-10" onClick={onClose}>
        <img
          src={src}
          alt="Attachment preview"
          style={{ transform: `scale(${scale})` }}
          className="max-h-full max-w-full object-contain transition-transform duration-150"
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </div>
  );
};

const CommentThread: React.FC<{
  sectionId: string;
  comments: ReportComment[];
  currentUser: string;
  isAdmin: boolean;
  onAddComment: (
    sectionId: string,
    text: string,
    parentId?: string | null,
    attachments?: ReportCommentAttachment[]
  ) => Promise<void> | void;
  onDeleteComment?: (commentId: string) => Promise<void> | void;
  onPickMedia?: (type: 'image' | 'video') => Promise<{ url: string; name: string } | null>;
  depth?: number;
  parentId?: string | null;
}> = ({ sectionId, comments, currentUser, isAdmin, onAddComment, onDeleteComment, onPickMedia, depth = 0, parentId = null }) => {
  const [replyingTo, setReplyingTo] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [replyAttachments, setReplyAttachments] = React.useState<ReportCommentAttachment[]>([]);
  const [linkModalOpen, setLinkModalOpen] = React.useState(false);
  const [viewerImage, setViewerImage] = React.useState<string | null>(null);
  const thread = comments.filter((entry) => entry.sectionId === sectionId && entry.parentId === parentId);

  const renderAttachments = (attachments: ReportCommentAttachment[] = []) => {
    if (!attachments.length) return null;
    return (
      <div className="mt-3 grid gap-2">
        {attachments.map((attachment) => (
          <div key={attachment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
            {attachment.type === 'image' && (
              <img
                src={attachment.url}
                alt={attachment.label || 'Comment attachment'}
                className="max-h-64 w-full object-contain rounded-lg bg-white cursor-zoom-in"
                onClick={() => setViewerImage(attachment.url)}
              />
            )}
            {attachment.type === 'video' && (
              <video src={attachment.url} controls className="max-h-72 w-full rounded-lg bg-black" />
            )}
            {attachment.type === 'link' && (
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-sky-700 underline break-all"
              >
                {attachment.label || attachment.url}
              </a>
            )}
          </div>
        ))}
      </div>
    );
  };

  const canDelete = (entry: ReportComment) =>
    onDeleteComment && (isAdmin || entry.user === currentUser);

  return (
    <div className="space-y-3">
      <LinkAttachModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onAttach={(url, label) => {
          setReplyAttachments((prev) => [
            ...prev,
            { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'link', url, label: label || 'Reference link' },
          ]);
        }}
      />
      <ImageViewerModal src={viewerImage} onClose={() => setViewerImage(null)} />
      {thread.map((entry) => (
        <div key={entry.id} className="relative pl-10">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-200" />
          <div className="absolute left-[-6px] top-5 h-3 w-3 rounded-full bg-sky-600 ring-4 ring-sky-100" />
          <div className="py-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center">
                  {entry.user.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.14em]">{entry.user}</p>
                  {isAdmin && entry.user !== currentUser && (
                    <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Admin view</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-bold text-slate-400">{formatTime(entry.timestamp)}</p>
                {canDelete(entry) && (
                  deletingId === entry.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-semibold">Delete?</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteComment!(entry.id);
                          setDeletingId(null);
                        }}
                        className="rounded-lg bg-rose-500 px-2 py-1 text-[10px] font-black text-white hover:bg-rose-600"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-500 hover:bg-slate-50"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeletingId(entry.id)}
                      title={isAdmin && entry.user !== currentUser ? 'Delete comment (admin)' : 'Delete your comment'}
                      className="p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{entry.text}</p>
            {renderAttachments(entry.attachments)}
            <button
              onClick={() => setReplyingTo((prev) => (prev === entry.id ? null : entry.id))}
              className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600 hover:text-indigo-500"
            >
              Reply
            </button>
            {replyingTo === entry.id && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a reply..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10"
                />
                {replyAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {replyAttachments.map((attachment, index) => (
                      <AttachmentChip
                        key={attachment.id}
                        attachment={attachment}
                        onRemove={() => setReplyAttachments((prev) => prev.filter((_, i) => i !== index))}
                      />
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!onPickMedia) return;
                      const media = await onPickMedia('image');
                      if (!media) return;
                      setReplyAttachments((prev) => [...prev, { id: `a-${Date.now()}`, type: 'image', url: media.url, label: media.name }]);
                    }}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                    title="Attach image"
                    aria-label="Attach image"
                  >
                    <ImageIcon size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!onPickMedia) return;
                      const media = await onPickMedia('video');
                      if (!media) return;
                      setReplyAttachments((prev) => [...prev, { id: `a-${Date.now()}`, type: 'video', url: media.url, label: media.name }]);
                    }}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                    title="Attach video"
                    aria-label="Attach video"
                  >
                    <Video size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkModalOpen(true)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                    title="Attach link"
                    aria-label="Attach link"
                  >
                    <Link2 size={14} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const text = draft.trim();
                      if (!text && !replyAttachments.length) return;
                      await onAddComment(sectionId, text, entry.id, replyAttachments);
                      setDraft('');
                      setReplyAttachments([]);
                      setReplyingTo(null);
                    }}
                    className="rounded-xl bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-indigo-500"
                  >
                    Send Reply
                  </button>
                  <button
                    onClick={() => {
                      setDraft('');
                      setReplyAttachments([]);
                      setReplyingTo(null);
                    }}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          {depth < 5 && (
            <div className="ml-2 mt-3 border-l border-slate-200 pl-4">
              <CommentThread
                sectionId={sectionId}
                comments={comments}
                currentUser={currentUser}
                isAdmin={isAdmin}
                onAddComment={onAddComment}
                onDeleteComment={onDeleteComment}
                onPickMedia={onPickMedia}
                depth={depth + 1}
                parentId={entry.id}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const SectionComments: React.FC<{
  sectionId: string;
  comments: ReportComment[];
  currentUser: string;
  isAdmin: boolean;
  onAddComment: (
    sectionId: string,
    text: string,
    parentId?: string | null,
    attachments?: ReportCommentAttachment[]
  ) => Promise<void> | void;
  onDeleteComment?: (commentId: string) => Promise<void> | void;
  onPickMedia?: (type: 'image' | 'video') => Promise<{ url: string; name: string } | null>;
}> = ({ sectionId, comments, currentUser, isAdmin, onAddComment, onDeleteComment, onPickMedia }) => {
  const [draft, setDraft] = React.useState('');
  const [attachments, setAttachments] = React.useState<ReportCommentAttachment[]>([]);
  const [linkModalOpen, setLinkModalOpen] = React.useState(false);
  const count = comments.filter((entry) => entry.sectionId === sectionId).length;

  return (
    <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5 md:p-7 space-y-6 shadow-sm">
      <LinkAttachModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onAttach={(url, label) => {
          setAttachments((prev) => [
            ...prev,
            { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'link', url, label: label || 'Reference link' },
          ]);
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.25em]">Conversation</h5>
          <p className="text-xs font-semibold text-slate-500 mt-1">Team timeline and replies</p>
        </div>
        <span className="rounded-full bg-sky-50 border border-sky-100 px-2.5 py-1 text-[10px] font-black text-sky-700">{count}</span>
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Comment as {currentUser}</p>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Discuss this section with your team..."
          className="w-full min-h-[90px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10"
        />
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <AttachmentChip
                key={attachment.id}
                attachment={attachment}
                onRemove={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
              />
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              if (!onPickMedia) return;
              const media = await onPickMedia('image');
              if (!media) return;
              setAttachments((prev) => [...prev, { id: `a-${Date.now()}`, type: 'image', url: media.url, label: media.name }]);
            }}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            title="Attach image"
            aria-label="Attach image"
          >
            <ImageIcon size={14} />
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!onPickMedia) return;
              const media = await onPickMedia('video');
              if (!media) return;
              setAttachments((prev) => [...prev, { id: `a-${Date.now()}`, type: 'video', url: media.url, label: media.name }]);
            }}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            title="Attach video"
            aria-label="Attach video"
          >
            <Video size={14} />
          </button>
          <button
            type="button"
            onClick={() => setLinkModalOpen(true)}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            title="Attach link"
            aria-label="Attach link"
          >
            <Link2 size={14} />
          </button>
        </div>
        <button
          onClick={async () => {
            const text = draft.trim();
            if (!text && !attachments.length) return;
            await onAddComment(sectionId, text, null, attachments);
            setDraft('');
            setAttachments([]);
          }}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-indigo-500"
        >
          Add Comment
        </button>
      </div>
      <div className="pt-2">
        <CommentThread
          sectionId={sectionId}
          comments={comments}
          currentUser={currentUser}
          isAdmin={isAdmin}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
          onPickMedia={onPickMedia}
        />
      </div>
    </div>
  );
};

export const FindingReport: React.FC<{
  finding: Issue;
  currentUser?: string;
  isAdmin?: boolean;
  onAddSectionComment?: (
    sectionId: string,
    text: string,
    parentId?: string | null,
    attachments?: ReportCommentAttachment[]
  ) => Promise<void> | void;
  onDeleteSectionComment?: (commentId: string) => Promise<void> | void;
  onPickCommentMedia?: (type: 'image' | 'video') => Promise<{ url: string; name: string } | null>;
}> = ({ finding, currentUser = 'Team Member', isAdmin = false, onAddSectionComment, onDeleteSectionComment, onPickCommentMedia }) => {
  const comments = finding.reportSectionComments || [];
  const sla = getSlaStatus(finding);
  const evidenceScore = getIsoEvidenceScore(finding);
  const procedureGaps = getProcedureGaps(finding);
  return (
    <div className="max-w-[980px] mx-auto bg-white overflow-hidden min-h-screen">
      <div className="px-8 py-8 lg:px-10 lg:py-10 space-y-10">
        
        {/* Report Identity Profile */}
        <div className="space-y-8">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <h4 className="text-[10px] font-black text-[#475569] uppercase tracking-[0.16em]">Vulnerability Report</h4>
              <img src="/assets/app-logo.png" alt="Welford logo" className="h-9 w-9 object-contain opacity-90" />
            </div>
            <h1 className="text-[38px] font-bold tracking-tight leading-[1.1] text-[#0c1e3a]">
              {finding.title}
            </h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.12em] leading-none">CVSS</h4>
              <p className={`text-[28px] font-black ${parseFloat(finding.cvssScore) >= 7 ? 'text-rose-700' : 'text-indigo-700'} tabular-nums`}>
                {finding.cvssScore}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.12em] leading-none">Severity</h4>
              <SeverityBadge severity={finding.severity} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 lg:col-span-1">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.12em] leading-none">CVSS Vector</h4>
              <p className="text-[12px] font-mono text-[#334f79] break-all leading-relaxed">{finding.cvssVector}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.12em] leading-none">Domain</h4>
              <p className="text-sm font-bold text-[#0f2346]">{finding.type}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.12em] leading-none">Affected Asset</h4>
              <p className="text-sm font-bold text-[#0f2346]">{finding.affected || 'General Scope'}</p>
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-6 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-indigo-600 border border-indigo-100">
                <ClipboardCheck size={18} />
              </div>
              <div>
                <h3 className="text-[10px] font-black text-[#4b62d6] uppercase tracking-[0.12em]">{ISO_CONTROL_REFERENCE}</h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Audit information</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${
                sla.tone === 'danger' ? 'border-rose-100 bg-rose-50 text-rose-600' :
                sla.tone === 'warning' ? 'border-amber-100 bg-amber-50 text-amber-600' :
                sla.tone === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-600' :
                'border-slate-200 bg-white text-slate-500'
              }`}>
                <Clock3 size={12} className="inline mr-1" /> {sla.label}
              </span>
              <span className="rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-indigo-700">
                {evidenceScore}% Complete
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['Date Found', finding.dateIdentified || emptyText],
              ['How It Was Found', finding.vulnerabilitySource || emptyText],
              ['Data Classification', finding.assetClassification || emptyText],
              ['Exposure', finding.exposure || emptyText],
              ['Owner', finding.remediationOwner || 'Not assigned'],
              ['Due Date', getIssueDueDate(finding) || 'Routine maintenance'],
              ['Completed', finding.remediationCompletedDate || 'Pending'],
              ['Verification', finding.verificationResult || 'Not Verified'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
                <p className="mt-2 text-sm font-bold text-[#0f2346] break-words">{value}</p>
              </div>
            ))}
          </div>

          {(finding.businessImpact || finding.remediationAction || finding.exceptionRequired) && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 mb-2">Business Impact</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{finding.businessImpact || emptyText}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 mb-2">Fix Plan</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{finding.remediationAction || finding.solution || emptyText}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 mb-2">Exception</p>
                {finding.exceptionRequired ? (
                  <div className="space-y-2 text-sm text-slate-700">
                    <p className="whitespace-pre-wrap">{finding.exceptionJustification || 'Reason not added yet'}</p>
                    <p><strong>Temporary controls:</strong> {finding.compensatingControls || emptyText}</p>
                    <p><strong>Approved by:</strong> {finding.riskAcceptanceApprover || 'Pending'} {finding.riskAcceptanceDate ? `on ${finding.riskAcceptanceDate}` : ''}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-700">No exception is currently needed.</p>
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white bg-white/70 p-4">
            {procedureGaps.length ? (
              <p className="text-xs font-bold text-amber-700">To make this report audit ready, add: {procedureGaps.join(', ')}.</p>
            ) : (
              <p className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                <ShieldCheck size={14} /> This report has the key information needed for an audit review.
              </p>
            )}
          </div>
        </section>

        {/* Primary Narrative Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
              <BookOpen size={18} />
            </div>
            <h3 className="text-2xl font-black text-[#0c1e3a] tracking-tight">Description</h3>
          </div>
          <div className="ml-5 border-l-2 border-slate-100 pl-10">
            <MarkdownRenderer content={finding.description} />
          </div>
        </section>

        {/* Additional report sections */}
        {finding.customFields && finding.customFields.length > 0 && (
          <div className="pt-12 border-t border-slate-100 space-y-16 pb-24">
            {finding.customFields.map(f => (
              <section key={f.id} className="space-y-4 ml-5 border-l-2 border-slate-100 pl-10">
                <h4 className="text-[10px] font-black text-[#4b62d6] uppercase tracking-[0.12em] leading-none">{f.label || 'Additional Context'}</h4>
                <div className="text-[15px] text-slate-800">
                  <MarkdownRenderer content={f.value} />
                </div>
              </section>
            ))}
          </div>
        )}

        {onAddSectionComment && (
          <section className="pt-8 border-t border-slate-100" data-report-comments="true">
            <SectionComments
              sectionId="report"
              comments={comments}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onAddComment={onAddSectionComment}
              onDeleteComment={onDeleteSectionComment}
              onPickMedia={onPickCommentMedia}
            />
          </section>
        )}
      </div>
    </div>
  );
};
