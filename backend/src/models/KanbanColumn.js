const prisma = require('../lib/prisma');

class KanbanColumn {
  static async create(columnData) {
    const { workspaceId, name, position, isDefault } = columnData;

    return await prisma.kanbanColumn.create({
      data: {
        workspaceId,
        name,
        position: position !== undefined ? position : 0,
        isDefault: isDefault || false
      }
    });
  }

  static async findById(id) {
    return await prisma.kanbanColumn.findUnique({
      where: { id },
      include: {
        workspace: true,
        tasks: {
          orderBy: { position: 'asc' },
          include: {
            actionItem: {
              include: {
                meeting: {
                  select: { id: true, title: true, startTime: true }
                }
              }
            }
          }
        }
      }
    });
  }

  static async findByWorkspace(workspaceId) {
    return await prisma.kanbanColumn.findMany({
      where: { workspaceId },
      include: {
        tasks: {
          orderBy: { position: 'asc' },
          include: {
            actionItem: {
              include: {
                meeting: {
                  select: { id: true, title: true, startTime: true }
                }
              }
            }
          }
        }
      },
      orderBy: { position: 'asc' }
    });
  }

  static async update(id, updateData) {
    const allowedFields = ['name', 'position'];
    const filteredData = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateData[key];
        return obj;
      }, {});

    return await prisma.kanbanColumn.update({
      where: { id },
      data: filteredData
    });
  }

  static async delete(id) {
    // Check if column is default
    const column = await prisma.kanbanColumn.findUnique({
      where: { id },
      include: { tasks: true }
    });

    if (!column) {
      throw new Error('Column not found');
    }

    if (column.isDefault) {
      throw new Error('Cannot delete default column');
    }

    if (column.tasks.length > 0) {
      throw new Error('Cannot delete column with tasks');
    }

    return await prisma.kanbanColumn.delete({
      where: { id }
    });
  }

  static async reorder(workspaceId, columnId, newPosition) {
    // Get all columns in the workspace
    const columns = await prisma.kanbanColumn.findMany({
      where: { workspaceId },
      orderBy: { position: 'asc' }
    });

    // Find the column being moved
    const columnIndex = columns.findIndex(c => c.id === columnId);
    if (columnIndex === -1) {
      throw new Error('Column not found in workspace');
    }

    // Remove column from its current position
    const [column] = columns.splice(columnIndex, 1);

    // Insert at new position
    columns.splice(newPosition, 0, column);

    // Update positions in database
    const updates = columns.map((c, index) =>
      prisma.kanbanColumn.update({
        where: { id: c.id },
        data: { position: index }
      })
    );

    await Promise.all(updates);

    return await this.findById(columnId);
  }
}

module.exports = KanbanColumn;


