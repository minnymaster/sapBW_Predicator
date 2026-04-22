import { PartialType } from '@nestjs/swagger';
import { CreateQuestionDto } from './create-question.dto';

// PUT создаёт новую версию вопроса (NFR-18): все поля опциональны,
// незаполненные копируются из предыдущей версии.
export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}
