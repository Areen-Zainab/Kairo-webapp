const prisma = require('../lib/prisma');

class MeetingNote {
  /**
   * Create a new meeting note
   */
  static async create({
    meetingId,
    userId,
    content,
    type = 'manual',
    timestamp = 0,
    color = '#3b82f6',
    authorName
  }) {
    const note = await prisma.meetingNote.create({
      data: {
        meetingId,
        userId,
        content,
        type,
        timestamp,
        color,
        authorName
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePictureUrl: true
          }
        }
      }
    });

    return this._toDTO(note);
  }

  /**
   * Get all notes for a meeting, ordered by timestamp then createdAt
   */
  static async findByMeetingId(meetingId) {
    const notes = await prisma.meetingNote.findMany({
      where: { meetingId },
      orderBy: [
        { timestamp: 'asc' },
        { createdAt: 'asc' }
      ],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePictureUrl: true
          }
        }
      }
    });

    return notes.map(this._toDTO);
  }

  /**
   * Update a note (only owner can update; enforced in route)
   */
  static async update(id, updates) {
    const note = await prisma.meetingNote.update({
      where: { id },
      data: updates,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePictureUrl: true
          }
        }
      }
    });

    return this._toDTO(note);
  }

  /**
   * Delete a note
   */
  static async delete(id) {
    await prisma.meetingNote.delete({
      where: { id }
    });
  }

  /**
   * Get a single note by id
   */
  static async findById(id) {
    const note = await prisma.meetingNote.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePictureUrl: true
          }
        }
      }
    });

    return note ? this._toDTO(note) : null;
  }

  /**
   * Convert DB entity to a DTO shape the frontend expects
   */
  static _toDTO(note) {
    return {
      id: note.id,
      meetingId: note.meetingId,
      content: note.content,
      type: note.type,
      timestamp: note.timestamp,
      color: note.color,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      author: {
        id: note.user?.id,
        name: note.authorName || note.user?.name || note.user?.email || 'Unknown',
        avatar: note.user?.name
          ? note.user.name
              .split(' ')
              .map(p => p[0])
              .join('')
              .toUpperCase()
          : 'UN'
      }
    };
  }
}

module.exports = MeetingNote;


