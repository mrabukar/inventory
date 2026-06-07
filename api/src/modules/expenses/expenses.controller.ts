import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { ExpenseQueryDto } from "./dto/expense-query.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { ExpensesService } from "./expenses.service";

@Roles(UserRole.admin)
@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(@Query() query: ExpenseQueryDto) {
    return this.expensesService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.expensesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.expensesService.create(dto, user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.expensesService.update(id, dto, user);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.expensesService.remove(id, user);
  }
}
