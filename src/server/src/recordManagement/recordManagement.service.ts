import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Connection } from "typeorm";
import { RecordManagementInterface } from "./recordManagement.interface";
import { RecordManagement } from "./recordManagement.entity";
import { DatabaseResInf } from "../lib/globalInterface";
import { removeSync } from "fs-extra";
import { join, extname } from "path";
import { uploadDir } from "../lib/globalVars";

@Injectable()
export class RecordManagementService {
  constructor(
    @InjectRepository(RecordManagement)
    private rmRepository: Repository<RecordManagement>,
    private readonly connection: Connection,
  ) {}
  async create(item: RecordManagementInterface): Promise<DatabaseResInf> {
    const newItem = new RecordManagement();
    newItem.name = item.name;
    newItem.path = item.path;
    newItem.mimetype = item.mimetype;
    newItem.size = item.size;
    newItem.logs = item.logs;
    newItem.originalname = item.originalname;
    newItem.encoding = item.encoding;
    newItem.startTime = item.startTime;
    newItem.subtitle = item.name.replace(extname(item.name), "") + ".vtt";

    try {
      await this.connection.manager.save(newItem);
      return { success: true, message: "创建成功", data: newItem };
    } catch (e) {
      return { success: false, message: "创建失败", data: newItem, error: e };
    }
  }

  async findAll(): Promise<RecordManagement[]> {
    const items = await this.rmRepository.find();
    return items.map((item) => ({ ...item, logs: [], path: "" }));
  }

  getTotalCount(): Promise<number> {
    return this.rmRepository.count();
  }

  async findByLimit(skip = "0", take = "10"): Promise<DatabaseResInf> {
    try {
      const items = await this.rmRepository
        .createQueryBuilder()
        .skip(Number(skip))
        .take(Number(take))
        .getMany();
      return {
        success: true,
        data: items.map((item) => ({
          ...item,
          logs: [],
          path: "",
          size: (Number(item.size) / 1024 / 1024).toFixed(2),
        })),
        message: "查找成功",
      };
    } catch (e) {
      return { success: false, data: [], message: `查找失败：${e}` };
    }
  }

  async findByPK(id: string): Promise<DatabaseResInf> {
    const ids = [...new Set(id.split(","))];
    const items = await this.rmRepository.find({
      where: ids.map((id) => ({ id })),
    });

    if (items.length === ids.length) {
      return {
        success: true,
        message: "查找成功",
        data: items.map((item) => ({
          ...item,
          path: `/static/uploads/${item.name}`,
          subtitle: `/static/uploads/${item.subtitle}`,
        })),
      };
    } else if (items.length === 0) {
      return { success: false, message: `ID：${id} 不存在` };
    } else {
      return {
        success: true,
        data: items,
        message: `部分查找成功，ID：${ids.filter(
          (id) => !items.some((item) => Number(item.id) === Number(id)),
        )} 不存在`,
      };
    }
  }

  async remove(id: string): Promise<DatabaseResInf> {
    const ids = [...new Set(id.split(","))];
    const items = await this.rmRepository.find({
      where: ids.map((id) => ({ id })),
    });
    items.forEach((item) => {
      removeSync(join(uploadDir, item.name));
    });

    try {
      await this.rmRepository.delete(ids);
      return { success: true, message: `ID：${ids.join(",")}删除成功` };
    } catch (e) {
      return { success: false, message: `删除失败：${e}` };
    }
  }
}
